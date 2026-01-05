class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.collisionGroup = null;
        this.playerSpeed = 120;
        this.lastDirection = 'down';
        this.isMultiplayer = false;
        this.spawnPosition = null;
        this.playerName = '';
        this.nameText = null;
    }

    // Called from main.js to set multiplayer spawn position
    setMultiplayerData(spawnPos, playerName) {
        this.spawnPosition = spawnPos;
        this.playerName = playerName;
        this.isMultiplayer = true;
    }

    create() {
        // Get map dimensions from the loaded image
        const mapTexture = this.textures.get('map');
        const mapWidth = mapTexture.getSourceImage().width;
        const mapHeight = mapTexture.getSourceImage().height;

        // Add the map as background (depth 0)
        this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(0);

        // Set world bounds to match map size
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

        // Create collision bodies from Tiled data
        this.createCollisions();

        // Determine spawn position (multiplayer spawn or center)
        let spawnX = mapWidth / 2;
        let spawnY = mapHeight / 2;
        if (this.spawnPosition) {
            spawnX = this.spawnPosition.x;
            spawnY = this.spawnPosition.y;
        }

        // Create the player
        this.createPlayer(spawnX, spawnY);

        // Add player name tag if multiplayer
        if (this.isMultiplayer && this.playerName) {
            this.nameText = this.add.text(
                this.player.x,
                this.player.y - 25,
                this.playerName,
                {
                    font: '10px Arial',
                    fill: '#00ff00',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    padding: { x: 4, y: 2 }
                }
            );
            this.nameText.setOrigin(0.5);
            this.nameText.setDepth(15);
        }

        // Add foreground layer (renders ABOVE player - depth 20)
        // This creates the illusion of walking behind trees/houses
        if (this.textures.exists('foreground')) {
            this.add.image(0, 0, 'foreground').setOrigin(0, 0).setDepth(20);
        }

        // Setup camera to follow player
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(2.5); // Zoom in for pixel art style

        // Setup keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();

        // WASD keys as alternative
        this.wasd = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };

        // Store reference in multiplayer manager
        if (this.isMultiplayer && typeof multiplayerManager !== 'undefined') {
            multiplayerManager.gameScene = this;
        }
    }

    createPlayer(x, y) {
        // Create player sprite with physics (start facing down)
        this.player = this.physics.add.sprite(x, y, 'player-down');
        this.player.setCollideWorldBounds(true);

        // Scale down the sprite to fit the 12x12 tile map
        this.player.setScale(0.3);

        // Adjust player hitbox to be smaller than sprite (for better collision feel)
        // Sprite is 48x68 scaled to 0.3 = ~14x20 visible, hitbox at feet
        this.player.body.setSize(24, 20);
        this.player.body.setOffset(12, 46);

        // Set player depth to be above ground but below foreground
        this.player.setDepth(10);

        // Start with idle animation facing down
        this.player.anims.play('idle-down');

        // Add collision with collision group
        if (this.collisionGroup) {
            this.physics.add.collider(this.player, this.collisionGroup);
        }
    }

    createCollisions() {
        // Create a static physics group for collision bodies
        this.collisionGroup = this.physics.add.staticGroup();

        // Get the map JSON data
        const mapData = this.cache.json.get('mapData');

        if (!mapData || !mapData.layers) {
            console.warn('No map data found or layers missing');
            return;
        }

        // Find the map origin from the base layer (water layer defines the PNG bounds)
        // The PNG was exported starting from this tile position
        const baseLayer = mapData.layers.find(layer => layer.name === 'water');
        const mapOriginX = baseLayer ? (baseLayer.startx || 0) : -64;
        const mapOriginY = baseLayer ? (baseLayer.starty || 0) : 0;

        console.log(`Map origin (tiles): ${mapOriginX}, ${mapOriginY}`);

        // Find the collisions layer
        const collisionLayer = mapData.layers.find(layer => layer.name === 'collisions');

        if (!collisionLayer) {
            console.warn('No collision layer found in map data');
            return;
        }

        const tileWidth = mapData.tilewidth || 12;
        const tileHeight = mapData.tileheight || 12;

        // Store origin for chunk processing
        this.mapOriginX = mapOriginX;
        this.mapOriginY = mapOriginY;

        // Handle infinite map with chunks
        if (collisionLayer.chunks) {
            collisionLayer.chunks.forEach(chunk => {
                this.processCollisionChunk(chunk, tileWidth, tileHeight);
            });
        }
        // Handle regular tile layer
        else if (collisionLayer.data) {
            this.processCollisionData(
                collisionLayer.data,
                collisionLayer.width,
                collisionLayer.height,
                0, 0,
                tileWidth, tileHeight
            );
        }

        console.log(`Created ${this.collisionGroup.getLength()} collision bodies`);
    }

    processCollisionChunk(chunk, tileWidth, tileHeight) {
        const { data, width, height, x: chunkX, y: chunkY } = chunk;

        // Convert chunk tile position to pixel position relative to PNG origin
        // PNG starts at (mapOriginX, mapOriginY) in tile coordinates
        // So pixel position = (chunkTilePos - mapOrigin) * tileSize
        const pixelOffsetX = (chunkX - this.mapOriginX) * tileWidth;
        const pixelOffsetY = (chunkY - this.mapOriginY) * tileHeight;

        this.processCollisionData(data, width, height, pixelOffsetX, pixelOffsetY, tileWidth, tileHeight);
    }

    processCollisionData(data, width, height, offsetX, offsetY, tileWidth, tileHeight) {
        // Create collision rectangles for non-zero tiles
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tileIndex = data[y * width + x];

                // If tile is not empty (0), create a collision body
                if (tileIndex !== 0) {
                    const pixelX = offsetX + (x * tileWidth) + (tileWidth / 2);
                    const pixelY = offsetY + (y * tileHeight) + (tileHeight / 2);

                    // Create invisible collision rectangle
                    const collider = this.add.rectangle(pixelX, pixelY, tileWidth, tileHeight);
                    this.physics.add.existing(collider, true); // true = static body
                    this.collisionGroup.add(collider);
                }
            }
        }
    }

    update() {
        if (!this.player) return;

        // Handle player movement
        this.handlePlayerMovement();

        // Update name tag position
        if (this.nameText) {
            this.nameText.x = this.player.x;
            this.nameText.y = this.player.y - 25;
        }

        // Interpolate remote players for smooth movement
        if (this.isMultiplayer && typeof multiplayerManager !== 'undefined') {
            multiplayerManager.interpolateRemotePlayers();
        }
    }

    handlePlayerMovement() {
        const velocity = { x: 0, y: 0 };
        let isMoving = false;

        // Check input (arrow keys or WASD)
        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;

        // Horizontal movement
        if (left) {
            velocity.x = -this.playerSpeed;
            this.lastDirection = 'left';
            isMoving = true;
        } else if (right) {
            velocity.x = this.playerSpeed;
            this.lastDirection = 'right';
            isMoving = true;
        }

        // Vertical movement
        if (up) {
            velocity.y = -this.playerSpeed;
            this.lastDirection = 'up';
            isMoving = true;
        } else if (down) {
            velocity.y = this.playerSpeed;
            this.lastDirection = 'down';
            isMoving = true;
        }

        // Normalize diagonal movement
        if (velocity.x !== 0 && velocity.y !== 0) {
            velocity.x *= 0.707; // 1/sqrt(2)
            velocity.y *= 0.707;
        }

        // Apply velocity
        this.player.setVelocity(velocity.x, velocity.y);

        // Play appropriate animation
        if (isMoving) {
            this.player.anims.play(`walk-${this.lastDirection}`, true);
        } else {
            this.player.anims.play(`idle-${this.lastDirection}`, true);
        }

        // Sync position to Firebase if multiplayer
        if (this.isMultiplayer && typeof multiplayerManager !== 'undefined') {
            multiplayerManager.updateLocalPlayer(
                this.player.x,
                this.player.y,
                this.lastDirection,
                isMoving
            );
        }
    }
}

// Note: Animations automatically switch textures since each direction
// uses a different spritesheet key (player-down, player-up, etc.)
