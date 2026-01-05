// MultiplayerManager.js - Firebase Real-time Multiplayer Handler

class MultiplayerManager {
    constructor() {
        this.db = null;
        this.playersRef = null;
        this.localPlayerId = null;
        this.localPlayerName = '';
        this.remotePlayers = new Map(); // playerId -> { data, sprite, nameText }
        this.gameScene = null;
        this.isConnected = false;
        this.updateInterval = null;
        this.lastUpdateTime = 0;
        this.updateThrottle = 50; // ms between position updates
    }

    // Initialize Firebase with config
    init(firebaseConfig) {
        try {
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            this.playersRef = this.db.ref('players');
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            return false;
        }
    }

    // Join the game world
    async joinGame(playerName, gameScene) {
        this.localPlayerName = playerName || 'Player';
        this.gameScene = gameScene;

        // Generate unique player ID
        this.localPlayerId = this.generatePlayerId();

        // Get map dimensions for spawn
        const mapTexture = gameScene.textures.get('map');
        const mapWidth = mapTexture.getSourceImage().width;
        const mapHeight = mapTexture.getSourceImage().height;

        // Random spawn position (within safe bounds)
        const spawnX = mapWidth / 2 + (Math.random() - 0.5) * 200;
        const spawnY = mapHeight / 2 + (Math.random() - 0.5) * 200;

        // Player data structure
        const playerData = {
            id: this.localPlayerId,
            name: this.localPlayerName,
            x: spawnX,
            y: spawnY,
            direction: 'down',
            isMoving: false,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        // Add player to Firebase
        await this.playersRef.child(this.localPlayerId).set(playerData);

        // Setup disconnect cleanup
        this.playersRef.child(this.localPlayerId).onDisconnect().remove();

        // Listen for other players
        this.setupPlayerListeners();

        this.isConnected = true;
        console.log(`Joined game as ${this.localPlayerName} (${this.localPlayerId})`);

        return { x: spawnX, y: spawnY };
    }

    // Generate unique player ID
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Setup Firebase listeners for other players
    setupPlayerListeners() {
        // Player joined
        this.playersRef.on('child_added', (snapshot) => {
            const playerData = snapshot.val();
            if (playerData && playerData.id !== this.localPlayerId) {
                this.addRemotePlayer(playerData);
            }
            this.updatePlayerCount();
        });

        // Player moved/updated
        this.playersRef.on('child_changed', (snapshot) => {
            const playerData = snapshot.val();
            if (playerData && playerData.id !== this.localPlayerId) {
                this.updateRemotePlayer(playerData);
            }
        });

        // Player left
        this.playersRef.on('child_removed', (snapshot) => {
            const playerData = snapshot.val();
            if (playerData) {
                this.removeRemotePlayer(playerData.id);
            }
            this.updatePlayerCount();
        });
    }

    // Add a remote player sprite to the scene
    addRemotePlayer(playerData) {
        if (this.remotePlayers.has(playerData.id)) return;
        if (!this.gameScene) return;

        // Create sprite for remote player
        const sprite = this.gameScene.physics.add.sprite(
            playerData.x,
            playerData.y,
            'player-down'
        );
        sprite.setScale(0.3);
        sprite.setDepth(10);
        sprite.setAlpha(0.9); // Slightly transparent to distinguish from local

        // Create name tag above player
        const nameText = this.gameScene.add.text(
            playerData.x,
            playerData.y - 25,
            playerData.name,
            {
                font: '10px Arial',
                fill: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: { x: 4, y: 2 }
            }
        );
        nameText.setOrigin(0.5);
        nameText.setDepth(15);

        // Store remote player
        this.remotePlayers.set(playerData.id, {
            data: playerData,
            sprite: sprite,
            nameText: nameText,
            targetX: playerData.x,
            targetY: playerData.y
        });

        console.log(`Remote player joined: ${playerData.name}`);
    }

    // Update remote player position and animation
    updateRemotePlayer(playerData) {
        const remote = this.remotePlayers.get(playerData.id);
        if (!remote) {
            this.addRemotePlayer(playerData);
            return;
        }

        // Update target position for smooth interpolation
        remote.targetX = playerData.x;
        remote.targetY = playerData.y;
        remote.data = playerData;

        // Update animation based on movement
        if (playerData.isMoving) {
            remote.sprite.anims.play(`walk-${playerData.direction}`, true);
        } else {
            remote.sprite.anims.play(`idle-${playerData.direction}`, true);
        }
    }

    // Remove remote player from scene
    removeRemotePlayer(playerId) {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
            remote.sprite.destroy();
            remote.nameText.destroy();
            this.remotePlayers.delete(playerId);
            console.log(`Remote player left: ${remote.data.name}`);
        }
    }

    // Update local player position to Firebase
    updateLocalPlayer(x, y, direction, isMoving) {
        if (!this.isConnected || !this.localPlayerId) return;

        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateThrottle) return;
        this.lastUpdateTime = now;

        this.playersRef.child(this.localPlayerId).update({
            x: x,
            y: y,
            direction: direction,
            isMoving: isMoving,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // Interpolate remote player positions (call in update loop)
    interpolateRemotePlayers() {
        const lerpFactor = 0.2; // Smoothing factor

        this.remotePlayers.forEach((remote) => {
            // Smooth position interpolation
            const dx = remote.targetX - remote.sprite.x;
            const dy = remote.targetY - remote.sprite.y;

            remote.sprite.x += dx * lerpFactor;
            remote.sprite.y += dy * lerpFactor;

            // Update name tag position
            remote.nameText.x = remote.sprite.x;
            remote.nameText.y = remote.sprite.y - 25;
        });
    }

    // Update player count display
    updatePlayerCount() {
        const countElement = document.getElementById('count');
        const countContainer = document.getElementById('player-count');
        if (countElement && countContainer) {
            const count = this.remotePlayers.size + 1; // +1 for local player
            countElement.textContent = count;
            countContainer.style.display = 'block';
        }
    }

    // Leave game and cleanup
    leaveGame() {
        if (this.localPlayerId && this.playersRef) {
            this.playersRef.child(this.localPlayerId).remove();
        }

        // Remove all remote player sprites
        this.remotePlayers.forEach((remote) => {
            remote.sprite.destroy();
            remote.nameText.destroy();
        });
        this.remotePlayers.clear();

        // Remove listeners
        if (this.playersRef) {
            this.playersRef.off();
        }

        this.isConnected = false;
        console.log('Left game');
    }

    // Get all remote players (for collision, etc.)
    getRemotePlayers() {
        return Array.from(this.remotePlayers.values());
    }

    // Check if connected
    getIsConnected() {
        return this.isConnected;
    }
}

// Global multiplayer manager instance
const multiplayerManager = new MultiplayerManager();
