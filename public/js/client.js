window.addEventListener("load", function(){
    const gameHeight = 720;
    const gameWidth = 3000;
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
        constructor(isPlayer, strength, vitality, agility, luck, range, spriteSource) {
            this.isPlayer = isPlayer;
            this.strength = strength;
            this.vitality = vitality;
            this.agility = agility;
            this.luck = luck;
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

            this.maxHP = (this.vitality * 10);
            this.hp = this.maxHP;
            this.speed = (this.agility * 0.75);

            this.moveable = true;
            this.target = null;
            this.timeOnAttack = 0;
            this.attackInterval = (5000 / this.agility);
            this.rangeWidth = this.range * this.width;
            this.rangeX = this.x;
            this.critChance = (this.luck / 20);
            this.damageNumbers = [];

            if (this.isPlayer) {
                this.x = 10 + cameraX; // spawn at the left of the map
            } else {
                this.x = gameWidth - this.width - 10 - cameraX;         // spawn at the right of the map
                this.speed *= -1;                                       // reverse the speed direction
                this.rangeX = this.x - (this.width * (this.range - 1)); // offset the rangeBox to the left
            }
        }

        // Draws the soldier and all graphics associated with it on the canvas.
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
    
            this.drawHitBoxes(context);
            this.drawStatusIcon(context);
            drawHealthBar(context, this);
            this.drawDamageNumbers(context);
        }

        // Draws the hitboxes of the soldier.
        drawHitBoxes(context) {
            // Hitbox outline
            context.strokeStyle = "white";
            context.strokeRect(this.x, this.y, this.width, this.height);

            // Rangebox outline
            context.strokeStyle = "red";
            context.strokeRect(this.rangeX, this.y, this.rangeWidth, this.height);
        }

        // Draws the combat icon above this soldier's head if it has a target. Or
        // the exclamation icon if it doesn't.
        drawStatusIcon(context) {
            let statusIconWidth = this.width / 2.5;
            let statusIconHeight = this.height / 2.5;
            let statusIconX = this.x + (this.width / 2) - (statusIconWidth / 2);
            let statusIconY = this.y - (statusIconHeight * 1.5);

            if (this.target == null) {
                context.drawImage(document.getElementById("exclamationIconImage"), statusIconX, statusIconY, statusIconWidth, statusIconHeight);
            } else {
                context.drawImage(document.getElementById("swordsIconImage"), statusIconX, statusIconY, statusIconWidth, statusIconHeight);
                this.drawAttackLoader(context, statusIconX, statusIconY, statusIconWidth, statusIconHeight);
            }
        }

        // Draws a transparent black box over the status icon that has a height equal to
        // the percent towards the next attack.
        drawAttackLoader(context, x, y, width, height) {
            let percentLoaded = this.timeOnAttack / this.attackInterval;
            context.fillStyle = "rgba(0, 0, 0, 0.5)";
            context.fillRect(x, y + height - (height * percentLoaded), width, (height * percentLoaded));
        }

        // Draws each damage number this soldier has.
        drawDamageNumbers(context) {
            this.damageNumbers.forEach(damageNumber => {
                damageNumber.draw(context);
                damageNumber.update();
            });
        }

        // Runs every animation frame
        update(timeSinceLastUpdate, soldiers, castles) {
            this.handleCombat(timeSinceLastUpdate, soldiers, castles);
            this.stopMovingIfAtEdge(castles);
            this.handleMovement(timeSinceLastUpdate);
            this.updateRangeX();
        }

        // If this soldier has a target, immobilizes them and tries to attack,
        // otherwise looks for a new target.
        handleCombat(timeSinceLastUpdate, soldiers, castles) {
            if (this.target != null) {
                this.moveable = false;
                this.handleAttack(timeSinceLastUpdate);
            } else {
                this.checkForNewTarget(soldiers, castles);
            }
        }

        // If the time attacking is greater than the attack interval, sets the time on
        // attack to 0 then deals damage. Otherwise do nothing. Then increase time on
        // attack by the time since the last call. Then check to see if the target is
        // dead and reset this soldiers target and allow it to move again.
        handleAttack(timeSinceLastUpdate) {
            if (this.timeOnAttack >= this.attackInterval) {
                this.timeOnAttack = 0;
                this.handleDamage();
            } else {
                // Attack is on cooldown.
            }

            this.timeOnAttack += timeSinceLastUpdate;

            if (this.target.hp <= 0) {
                this.moveable = true;
                this.target = null;
                this.timeOnAttack = 0;
            }
        }

        // Deal damage to this soldier's target, but doesn't reduce them past 0hp. Then
        // create a damage object with the target's information.
        handleDamage() {
            let damage = this.calculateDamage();
            // console.log("damage:" + damage);

            if (this.target.hp <= damage) {
                this.target.hp = 0;
            } else if (!(this.target.hp <= 0)) {
                this.target.hp -= damage;
            }

            this.target.damageNumbers.push(new DamageNumber(damage, this.target, this));
        }

        // TODO Documentation
        // Adds a random number between 0 and 1 to this soldier's strength, but if
        // that random number is less than this soldier's crit chance, doubles their
        // strength instead. Then returns their adjusted strength as damage.
        calculateDamage() {
            let damage = this.strength;

            const randomNumber = Math.random();
            if (randomNumber <= this.critChance) {
                damage *= 2;
                // console.log("crit:" + randomNumber + "/" + this.critChance);
            } else {
                damage += randomNumber - this.critChance;
                // console.log("damage+=" + (randomNumber - this.critChance));
            }

            return damage;
        }

        // TODO Documentation
        // Checks all soldiers that are not this soldier and on the other side to see 
        // if they are in range of this soldier's attacks then sets them to this 
        // soldier's target if so and if not clears this soldier's target.
        checkForNewTarget(soldiers, castles) {
            soldiers.forEach(soldier => {
                if (soldier === this) return;
                this.targetIfValidCollision(soldier);
            });
            castles.forEach(castle => {
                this.targetIfValidCollision(castle);
            });
        }

        // TODO Documentation
        // REQUIRES: Object has isPlayer,x,y,width,height
        targetIfValidCollision(object) {
            if (this.isPlayer && object.isPlayer) return;
            if (!this.isPlayer && !object.isPlayer) return;

            let hitBox = {x: object.x - cameraX, y: object.y, width: object.width, height: object.height};
            let rangeBox = {x: this.rangeX - cameraX, y: this.y, width: this.rangeWidth, height: this.height};

            if (hitBox.x < rangeBox.x + rangeBox.width && hitBox.x + hitBox.width > rangeBox.x) {
                this.target = object;
            } else {
                // No target found
            }
        }

        // Sets moveable to false if at the edge of the map.
        stopMovingIfAtEdge() {
            let relativeX = this.x - cameraX;
            if (relativeX >= (gameWidth - this.width) || relativeX <= 0) {
                this.moveable = false;
            }
        }

        // If moveable, move and animate the soldier. Otherwise just move them with
        // the camera speed.
        handleMovement(timeSinceLastUpdate) {
            if (this.moveable) {
                this.animateMovement(timeSinceLastUpdate);
                this.x += this.speed + cameraSpeed;
            } else {
                this.frame = 0;
                this.x += cameraSpeed;
            }
        }

        // If the time on the current frame exceeds the refreshrate, advance the frame
        // then reset the time on the current frame. Otherwise increase the time.
        animateMovement(timeSinceLastUpdate) {
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
        }

        // Updates the rangeX variable to the x variable and offset if enemy.
        updateRangeX() {
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
                if (this.x < (gameWidth * -1) + canvas.width) {
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

    class Castle {
        constructor(isPlayer) {
            this.isPlayer = isPlayer;
            this.maxHP = 100;
            this.hp = this.maxHP;
            this.image = document.getElementById("castleImage");

            this.width = 300;
            this.height = 300;
            this.y = gameHeight - this.height;
            this.damageNumbers = [];

            if (this.isPlayer) {
                this.x = 300; // spawn at the left of the map
            } else {
                this.x = gameWidth - this.width - 300; // spawn at the right of the map
            }
        }

        draw(context) {
            context.drawImage(this.image, this.x, this.y, this.width, this.height);
            drawHealthBar(context, this);
            this.drawDamageNumbers(context);
        }

        // Draws each damage number this castle has.
        drawDamageNumbers(context) {
            this.damageNumbers.forEach(damageNumber => {
                damageNumber.draw(context);
                damageNumber.update();
            });
        }

        update() {
            this.x += cameraSpeed;
        }
    }

    class DamageNumber {
        constructor(damage, reciever, dealer) {
            this.damage = damage;
            this.reciever = reciever;
            this.dealer = dealer;
            this.x = this.reciever.x + (this.reciever.width / 2);
            this.y = this.reciever.y;
            this.xScale = (Math.random() - 0.5) * 5;
            this.yScale = (Math.random() + 0.5) * 5;
        }

        draw(context) {
            context.fillStyle = "white";
            if (this.dealer.strength * 2 == this.damage) {
                context.fillStyle = "red";
            }
            let fontSize = 20 * (this.damage / this.dealer.strength);
            context.font = fontSize + "px Helvetica";
            context.fillText(Math.round(this.damage), this.x, this.y);
        }

        update() {
            this.x += this.xScale + cameraSpeed;
            this.y -= this.yScale;
            this.yScale -= 0.5;
        }
    }

    // Draws the healthbar and shows text of the health of the object given.
    // REQUIRES: Object has an x,y,width,height,hp,maxHP
    function drawHealthBar(context, object) {
        // Healthbar background
        context.fillStyle = "red";
        context.fillRect(
            object.x, 
            (object.y - object.height / 10), 
            object.width, 
            (object.height / 10));

        // Healthbar foreground
        context.fillStyle = "green";
        context.fillRect(
            object.x, 
            (object.y - object.height / 10), 
            object.width * (object.hp / object.maxHP), 
            (object.height / 10));

        // Healthbar label, rounds number out.
        context.fillStyle = "white";
        let fontSize = object.height / 7.5;
        context.font = fontSize + "px Helvetica";
        context.fillText(Math.round(object.hp) + "/" + object.maxHP, object.x, object.y);
    }

    const input = new InputHandler();
    // soldier(isPlayer, strength, vitality, agility, luck, range, sourceImage)
    const soldier0 = new Soldier(true, 2, 2, 4, 2, 4, "soldierImage");
    const soldier1 = new Soldier(false, 4, 4, 4, 4, 2, "soldierImage");
    let soldiers = [soldier0, soldier1];
    const playerCastle = new Castle(true);
    const enemyCastle = new Castle(false);
    let castles = [playerCastle, enemyCastle];
    const background = new Background();

    let food = 10;

    document.getElementById("spawnButton").addEventListener("click", function() {
        if (food > 0) {
            soldiers.push(new Soldier(true, 1, 1, 4, 1, 1, "soldierImage"));  
            food--;
        }
    })
    
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

        castles.forEach(castle => {
            castle.draw(ctx);
            castle.update();
        });
        castles = castles.filter(castle => castle.hp > 0);
        if (castles.length < 2) {
            if (castles[0].isPlayer) {
                alert("You win!");
            } else {
                alert("You lose!");
            }
        }      
        
        soldiers.forEach(soldier => {
            soldier.draw(ctx);
            soldier.update(deltaTimestamp, soldiers, castles);
        });
        soldiers = soldiers.filter(soldier => soldier.hp > 0);

        displayUI(ctx);
        requestAnimationFrame(animate);
    }

    animate(0);
});