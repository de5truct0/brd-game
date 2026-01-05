class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Show loading progress
        this.createLoadingBar();

        // Load the map image (background)
        this.load.image('map', 'assets/images/map.png');

        // Load the foreground layer (renders above player)
        this.load.image('foreground', 'assets/images/foreground.png');

        // Load the Tiled JSON map for collision data
        this.load.json('mapData', 'assets/maps/map.json');

        // Load player spritesheets (one per direction)
        this.load.spritesheet('player-down', 'assets/sprites/playerDown.png', {
            frameWidth: 48,
            frameHeight: 68
        });
        this.load.spritesheet('player-up', 'assets/sprites/playerUp.png', {
            frameWidth: 48,
            frameHeight: 68
        });
        this.load.spritesheet('player-left', 'assets/sprites/playerLeft.png', {
            frameWidth: 48,
            frameHeight: 68
        });
        this.load.spritesheet('player-right', 'assets/sprites/playerRight.png', {
            frameWidth: 48,
            frameHeight: 68
        });
    }

    createPlaceholderSprite() {
        // Create a 96x96 canvas for 4x4 grid of 24x24 sprites (16 frames)
        const canvas = document.createElement('canvas');
        canvas.width = 96;  // 4 columns x 24px
        canvas.height = 96; // 4 rows x 24px
        const ctx = canvas.getContext('2d');

        const colors = {
            body: '#4a90d9',      // Blue body
            outline: '#2d5a87',   // Darker outline
            skin: '#ffdbac',      // Skin tone
            hair: '#4a3728'       // Dark brown hair
        };

        // Draw 16 frames (4 directions x 4 animation frames)
        // Row 0: Walk down (frames 0-3)
        // Row 1: Walk up (frames 4-7)
        // Row 2: Walk left (frames 8-11)
        // Row 3: Walk right (frames 12-15)

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const x = col * 24;
                const y = row * 24;
                const bounce = (col % 2) * 1; // Slight bounce on alternating frames

                // Body
                ctx.fillStyle = colors.body;
                ctx.fillRect(x + 6, y + 10 - bounce, 12, 12);

                // Head
                ctx.fillStyle = colors.skin;
                ctx.fillRect(x + 7, y + 3 - bounce, 10, 8);

                // Hair (different for front/back)
                ctx.fillStyle = colors.hair;
                if (row === 0) {
                    // Facing down - bangs
                    ctx.fillRect(x + 7, y + 3 - bounce, 10, 3);
                } else if (row === 1) {
                    // Facing up - full hair
                    ctx.fillRect(x + 7, y + 2 - bounce, 10, 6);
                } else {
                    // Side view
                    ctx.fillRect(x + 7, y + 3 - bounce, 10, 4);
                }

                // Eyes (only for front and side views)
                if (row !== 1) {
                    ctx.fillStyle = '#000000';
                    if (row === 0) {
                        // Front facing
                        ctx.fillRect(x + 9, y + 6 - bounce, 2, 2);
                        ctx.fillRect(x + 13, y + 6 - bounce, 2, 2);
                    } else if (row === 2) {
                        // Left facing
                        ctx.fillRect(x + 8, y + 6 - bounce, 2, 2);
                    } else {
                        // Right facing
                        ctx.fillRect(x + 14, y + 6 - bounce, 2, 2);
                    }
                }

                // Legs (animate walking)
                ctx.fillStyle = colors.outline;
                if (col === 0 || col === 2) {
                    ctx.fillRect(x + 8, y + 20, 3, 3);
                    ctx.fillRect(x + 13, y + 20, 3, 3);
                } else {
                    ctx.fillRect(x + 7, y + 20, 3, 3);
                    ctx.fillRect(x + 14, y + 20, 3, 3);
                }
            }
        }

        // Add the canvas as a spritesheet texture with frame data
        const texture = this.textures.addCanvas('player', canvas);

        // Add frames to the texture (4 columns x 4 rows = 16 frames)
        const frameWidth = 24;
        const frameHeight = 24;
        let frameIndex = 0;

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                texture.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
                frameIndex++;
            }
        }
    }

    createLoadingBar() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Loading text
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '24px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Progress bar background
        const progressBarBg = this.add.rectangle(width / 2, height / 2, 400, 30, 0x222222);
        progressBarBg.setOrigin(0.5);

        // Progress bar fill
        const progressBar = this.add.rectangle(width / 2 - 195, height / 2, 0, 20, 0x00ff00);
        progressBar.setOrigin(0, 0.5);

        // Update progress bar on load progress
        this.load.on('progress', (value) => {
            progressBar.width = 390 * value;
        });

        // When loading complete
        this.load.on('complete', () => {
            loadingText.setText('Ready!');
        });
    }

    create() {
        // Create player animations
        this.createPlayerAnimations();

        // Start the game scene
        this.scene.start('GameScene');
    }

    createPlayerAnimations() {
        // Walk down animation
        this.anims.create({
            key: 'walk-down',
            frames: this.anims.generateFrameNumbers('player-down', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // Walk up animation
        this.anims.create({
            key: 'walk-up',
            frames: this.anims.generateFrameNumbers('player-up', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // Walk left animation
        this.anims.create({
            key: 'walk-left',
            frames: this.anims.generateFrameNumbers('player-left', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // Walk right animation
        this.anims.create({
            key: 'walk-right',
            frames: this.anims.generateFrameNumbers('player-right', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // Idle frames (first frame of each direction)
        this.anims.create({
            key: 'idle-down',
            frames: [{ key: 'player-down', frame: 0 }],
            frameRate: 1
        });

        this.anims.create({
            key: 'idle-up',
            frames: [{ key: 'player-up', frame: 0 }],
            frameRate: 1
        });

        this.anims.create({
            key: 'idle-left',
            frames: [{ key: 'player-left', frame: 0 }],
            frameRate: 1
        });

        this.anims.create({
            key: 'idle-right',
            frames: [{ key: 'player-right', frame: 0 }],
            frameRate: 1
        });
    }
}
