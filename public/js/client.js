window.addEventListener("load", function(){
    const gameHeight = 720;
    const gameWidth = 1920;
    const canvas = document.getElementById("canvas0");
    const ctx = canvas.getContext("2d");

    canvas.width = 1080;
    canvas.height = 720;

    let cameraSpeed = 0;
    let cameraX = 0;

    // Represents a user's input.
    class InputHandler {
        constructor() {
            this.pressedKeys = [];
            
            window.addEventListener("keydown", e => {
                if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && this.pressedKeys.indexOf(e.key) === -1) {
                    this.pressedKeys.push(e.key);
                }
            });

            window.addEventListener("keyup", e => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    this.pressedKeys.splice(this.pressedKeys.indexOf(e.key), 1);
                }
            });
        }
    }

    // Represents a soldier NPC that is either a player or enemy.
    class Soldier {
        constructor(isPlayer, strength, vitality, agility, range, spriteSource) {
            this.isPlayer = isPlayer;
            this.strength = strength;
            this.vitality = vitality;
            this.agility = agility;
            this.range = range;
        
            this.width = 100;
            this.height = 100;
            this.sourceWidth = 32;
            this.sourceHeight = 32;
            this.y = gameHeight - this.height;
            this.image = document.getElementById(spriteSource);

            this.frame = 0;
            this.maxFrame = 4;
            this.fps = 15;
            this.timeOnFrame = 0;

            this.maxHP = (this.vitality * 2);
            this.hp = this.maxHP;
            this.speed = (this.agility * 0.75);

            this.moveable = true;
            this.target = null;
            this.timeOnAttack = 0;
            this.attackInterval = (5000 / this.agility);
            this.rangeWidth = this.range * this.width;
            this.rangeX = this.x;

            if (this.isPlayer) {
                this.x = 10; // spawn at the left of the map
            } else {
                this.x = gameWidth - this.width - 10; // spawn at the right of the map
                this.speed *= -1; // reverse the speed direction if enemy
                this.rangeX = this.x - (this.width * (this.range - 1)); // offset the rangeBox to the left if enemy
            }
        }
        draw(context) {
            // Draw sprite 
            // TODO: Make a flipped source file for each soldier and draw from that if 'enemy'
            context.drawImage(
                this.image,                    // image
                this.frame * this.sourceWidth, // source x
                0,                             // source y
                this.sourceWidth,              // source width
                this.sourceHeight,             // source height
                this.x,                        // x
                this.y,                        // y
                this.width,                    // width 
                this.height);                  // height
    
            // Hitbox outline
            context.strokeStyle = "white";
            context.strokeRect(this.x, this.y, this.width, this.height);

            // Rangebox outline
            context.strokeStyle = "red";
            context.strokeRect(this.rangeX, this.y, this.rangeWidth, this.height);

            // Healthbar background
            context.fillStyle = "red";
            context.fillRect(
                this.x, 
                (this.y - this.height / 10), 
                this.width, 
                (this.height / 10));

            // Healthbar foreground
            context.fillStyle = "green";
            context.fillRect(
                    this.x, 
                    (this.y - this.height / 10), 
                    this.width * (this.hp / this.maxHP), 
                    (this.height / 10));

            // Healthbar label
            context.fillStyle = "white";
            context.font = "15px Helvetica";
            context.fillText(this.hp + "/" + this.maxHP, this.x, this.y);
        }
        update(timeSinceLastUpdate, soldiers) {
            // Check if attacking
            if (this.target != null) {
                this.moveable = false;
                if (this.timeOnAttack >= this.attackInterval) {
                    this.timeOnAttack = 0;
                    if (this.target.hp <= this.strength) {
                        this.target.hp = 0;
                    } else if (!(this.target.hp <= 0)) {
                        this.target.hp -= this.strength;
                    }
                } else {
                    // dont damage
                }
                this.timeOnAttack += timeSinceLastUpdate;
            } else {
                // Check if in range of enemies
                soldiers.forEach(soldier => {
                    if (!(soldier === this)) {
                        let hitBox = {x: soldier.x - cameraX, y: soldier.y, width: soldier.width, height: soldier.height};
                        let rangeBox = {x: this.rangeX - cameraX, y: this.y, width: this.rangeWidth, height: this.height};

                        if (hitBox.x < rangeBox.x + rangeBox.width &&
                            hitBox.x + hitBox.width > rangeBox.x) {
                            // Collision detected
                            this.target = soldier;
                        } else {
                            // No collision
                            this.target = null;
                        }
                    }
                });
            }

            // check if at map edge
            let relativeX = this.x - cameraX;
            if (relativeX >= (gameWidth - this.width) || relativeX <= 0) {
                this.moveable = false;
            }

            if (this.moveable) {
                // Animate movement
                if (this.timeOnFrame > (1000 / this.fps)) {
                    if (this.frame >= this.maxFrame) {
                        this.frame = 0;
                    } else {
                        this.frame++;
                    }
                    this.timeOnFrame = 0;
                } else {
                    this.timeOnFrame += timeSinceLastUpdate;
                }
                // Move soldier
                this.x += this.speed + cameraSpeed;
            } else {
                this.frame = 0;
                this.x += cameraSpeed;
            }

            // Flip rangebox if enemy
            if (this.isPlayer) {
                this.rangeX = this.x;
            } else {
                this.rangeX = this.x - (this.width * (this.range - 1));
            }
        }
    }

    // Represents an image that functions as the game's background.
    class Background {
        constructor() {
            this.image = document.getElementById("backgroundImage");
            this.x = 0;
            this.y = 0;
            this.width = gameWidth;
            this.height = gameHeight;
            this.speed = 0;
        }
        draw(context) {
            context.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
        update(input) {
            if (input.pressedKeys.indexOf("ArrowLeft") > -1) {
                if (this.x > -20) {
                    this.speed = 0;
                } else {
                    this.speed = 20;
                }
            } else if (input.pressedKeys.indexOf("ArrowRight") > -1) {
                if (this.x < -1100) {
                    this.speed = 0;
                } else {
                    this.speed = -20;
                }
            } else {
                this.speed = 0;
            }
            this.x += this.speed;
            cameraSpeed = this.speed;
            cameraX = this.x;
        }
    }

    const input = new InputHandler();
    // soldier(isPlayer, strength, vitality, agility, range, sourceImage)
    const soldier0 = new Soldier(true, 2, 2, 5, 5, "soldierImage");
    const soldier1 = new Soldier(false, 5, 5, 2, 2, "soldierImage");
    let soldiers = [soldier0, soldier1];
    const background = new Background();

    let food = 10;

    function displayUI(context) {
        context.fillStyle = "black";
        context.font = "40px Helvetica";
        context.fillText("Food: " + food, 20, 50);
    }

    let prevTimestamp = 0;

    function animate(timestamp) {
        const deltaTimestamp = timestamp - prevTimestamp;
        prevTimestamp = timestamp;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        background.draw(ctx);
        background.update(input);

        soldiers.forEach(soldier => {
            soldier.draw(ctx);
            soldier.update(deltaTimestamp, soldiers);
        });
        soldiers = soldiers.filter(soldier => soldier.hp > 0);

        displayUI(ctx);
        requestAnimationFrame(animate);
    }

    animate(0);
});