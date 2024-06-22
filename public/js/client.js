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
        constructor(side, strength, vitality, agility) {
            this.side = side; // player or enemy
            this.width = 200;
            this.height = 200;
            this.y = gameHeight - this.height;
            this.image = document.getElementById("soldierImage");

            this.frame = 0;
            this.maxFrame = 4;
            this.fps = 20;
            this.timeOnFrame = 0;

            this.maxHP = vitality;
            this.hp = this.maxHP;
            this.speed = agility;

            // initial spawn location
            if (this.side == "player") {
                this.x = 10;
            } else if (this.side == "enemy") {
                this.x = gameWidth - this.width - 10;
                this.speed *= -1;
            } else {
                console.error("Soldier is neither player nor enemy.");
            }
        }
        draw(context) {
            context.strokeStyle = "white";
            context.strokeRect(this.x, this.y, this.width, this.height);
            context.drawImage(
                this.image,                // image
                this.frame * this.width,   // source x
                0,                         // source y
                this.width,                // source width
                this.height,               // source height
                this.x,                    // x
                this.y,                    // y
                this.width,                // width 
                this.height);              // height

            context.fillStyle = "red";
            context.fillRect(
                this.x, 
                (this.y - this.height / 10), 
                this.width, 
                (this.height / 10));

            context.fillStyle = "green";
            context.fillRect(
                    this.x, 
                    (this.y - this.height / 10), 
                    this.width * (this.hp / this.maxHP), 
                    (this.height / 10));

            context.fillStyle = "white";
            context.font = "20px Helvetica";
            context.fillText(this.hp + "/" + this.maxHP, this.x, this.y);
        }
        update(timestamp) {
            // Animate movement
            if (this.timeOnFrame > (1000 / this.fps)) {
                if (this.frame >= this.maxFrame) {
                    this.frame = 0;
                } else {
                    this.frame++;
                }
                this.timeOnFrame = 0;
            } else {
                this.timeOnFrame += timestamp;
            }

            // Movement
            let relativeX = this.x - cameraX;
            if (relativeX >= (gameWidth - this.width) || relativeX <= 0) {
                this.x += cameraSpeed;
            } else {
                this.x += this.speed + cameraSpeed;
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
    const soldier0 = new Soldier("player", 1, 10, 3);
    const soldier1 = new Soldier("enemy", 1, 10, 3);
    const soldiers = [soldier0, soldier1];
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
        for (let i = 0; i < soldiers.length; i++) {
            soldiers[i].draw(ctx);
            soldiers[i].update(deltaTimestamp);
        }
        displayUI(ctx);
        requestAnimationFrame(animate);
    }

    animate(0);
});