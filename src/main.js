// Firebase Configuration - Replace with your own Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Game Configuration
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    pixelArt: true, // Important for crisp pixel art rendering
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Top-down game, no gravity
            debug: false // Set to true to see collision boxes
        }
    },
    scene: [BootScene, GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Create the game instance
const game = new Phaser.Game(config);

// Initialize Firebase
if (typeof multiplayerManager !== 'undefined') {
    multiplayerManager.init(firebaseConfig);
}

// Lobby UI Handler
document.addEventListener('DOMContentLoaded', () => {
    const lobbyOverlay = document.getElementById('lobby-overlay');
    const playerNameInput = document.getElementById('player-name');
    const joinBtn = document.getElementById('join-btn');

    // Handle join button click
    joinBtn.addEventListener('click', async () => {
        const playerName = playerNameInput.value.trim() || 'Player';
        await joinMultiplayerGame(playerName);
    });

    // Handle Enter key in input
    playerNameInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const playerName = playerNameInput.value.trim() || 'Player';
            await joinMultiplayerGame(playerName);
        }
    });

    // Focus input on load
    playerNameInput.focus();
});

// Join multiplayer game function
async function joinMultiplayerGame(playerName) {
    const lobbyOverlay = document.getElementById('lobby-overlay');
    const joinBtn = document.getElementById('join-btn');

    // Disable button during connection
    joinBtn.disabled = true;
    joinBtn.textContent = 'Connecting...';

    try {
        // Wait for game to be ready
        await waitForGameReady();

        // Get the GameScene
        const gameScene = game.scene.getScene('GameScene');

        // Join multiplayer game
        const spawnPos = await multiplayerManager.joinGame(playerName, gameScene);

        // Set multiplayer data on scene
        gameScene.setMultiplayerData(spawnPos, playerName);

        // Hide lobby overlay
        lobbyOverlay.classList.add('hidden');

        // If scene is already running, restart it with new spawn position
        if (game.scene.isActive('GameScene')) {
            game.scene.stop('GameScene');
            game.scene.start('GameScene');
        }

        console.log(`Joined game as: ${playerName}`);
    } catch (error) {
        console.error('Failed to join game:', error);
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Game';
        alert('Failed to connect. Please try again.');
    }
}

// Wait for game to be ready
function waitForGameReady() {
    return new Promise((resolve) => {
        const checkReady = () => {
            if (game.scene.isActive('GameScene') || game.scene.isActive('BootScene')) {
                // Give it a moment to fully initialize
                setTimeout(resolve, 100);
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (typeof multiplayerManager !== 'undefined') {
        multiplayerManager.leaveGame();
    }
});
