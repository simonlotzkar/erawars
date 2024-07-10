window.addEventListener("load", function(){
    const gameHeight = 720;
    const gameWidth = 3000;
    const gameFloor = 140;
    const canvas = document.getElementById("gameCanvas");
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

    class SoldierType {
        constructor(name, strength, vitality, agility, luck, range, spriteName, resourcesCost) {
            this.name = name;

            this.level = 0;
            this.xp = 0;
            this.xpMax = 100;

            this.strength = strength;
            this.vitality = vitality;
            this.agility = agility;
            this.luck = luck;
            this.range = range;

            this.spriteName = spriteName;

            this.resourcesCost = resourcesCost;
        }

        update() {
            if (this.xp >= this.xpMax) {
                this.level++;
                this.xp = 0;
                this.xpMax *= (1 + (1 / 3));

                this.strength *= (1 + (1 / 5));
                this.vitality *= (1 + (1 / 5));
                this.agility *= (1 + (1 / 5));
                this.luck *= (1 + (1 / 5));
                this.range *= (1 + (1 / 5));

                this.resourcesCost.increaseAllByPercent(10);
            }
        }
    }

    // Represents a soldier NPC that is either a player or enemy.
    class Soldier {
        constructor(isPlayer, soldierType, castle) {
            this.isPlayer = isPlayer;
            this.soldierType = soldierType;
            this.castle = castle;

            this.strength = this.soldierType.strength;
            this.vitality = this.soldierType.vitality;
            this.agility = this.soldierType.agility;
            this.luck = this.soldierType.luck;
            this.range = this.soldierType.range;
            
            this.width = 100;
            this.height = 100;
            this.sourceWidth = 32;
            this.sourceHeight = 32;
            this.y = gameHeight - this.height - gameFloor;            

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
                this.x = this.castle.x;
                this.image = document.getElementById(this.soldierType.spriteName);
            } else {
                this.x = this.castle.x + this.castle.width - this.width;
                this.speed *= -1;                                       // reverse the speed direction
                this.rangeX = this.x - (this.width * (this.range - 1)); // offset the rangeBox to the left

                this.image = document.getElementById(this.soldierType.spriteName);
                // this.image = document.getElementById(this.soldierType.spriteName + "Reversed");
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
        update(timeSinceLastUpdate, soldiers, teams) {
            this.handleCombat(timeSinceLastUpdate, soldiers, teams);
            this.stopMovingIfAtEdge();
            this.handleMovement(timeSinceLastUpdate);
            this.updateRangeX();
            this.damageNumbers = this.damageNumbers.filter(damageNumber => !damageNumber.deleteable);
        }

        // If this soldier has a target, immobilizes them and tries to attack,
        // otherwise looks for a new target.
        handleCombat(timeSinceLastUpdate, soldiers, teams) {
            if (this.target != null) {
                this.moveable = false;
                this.handleAttack(timeSinceLastUpdate);
            } else {
                this.checkForNewTarget(soldiers, teams);
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
        checkForNewTarget(soldiers, teams) {
            soldiers.forEach(soldier => {
                if (soldier === this) return;
                this.targetIfValidCollision(soldier);
            });
            teams.forEach(team => {
                this.targetIfValidCollision(team.castle);
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

    class Building {
        image;
        x;
        y;
        width;
        height;
        damageNumbers;

        constructor(isPlayer) {
            this.isPlayer = isPlayer;
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
            this.damageNumbers = this.damageNumbers.filter(damageNumber => !damageNumber.deleteable);
        }
    }

    class Castle extends Building {
        constructor(isPlayer) {
            super(isPlayer);
            this.maxHP = 100;
            this.hp = this.maxHP;
            this.damageNumbers = [];
            
            this.image = document.getElementById("castleImage");
            this.width = 300;
            this.height = 300;
            this.y = gameHeight - this.height - gameFloor;

            if (this.isPlayer) {
                this.x = 10;
            } else {
                this.x = gameWidth - this.width - 10;
            }

            this.buildingCount = 2;
            this.buildingPlots = [];
            for (let i = 0; i < this.buildingCount; i++) {
                if (this.isPlayer) {
                    this.buildingPlots.push(new BuildingPlot(true, this.x + this.width * 2 + this.width * i));
                } else {
                    this.buildingPlots.push(new BuildingPlot(false, this.x - this.width - this.width * i));
                }
            }
        }

        draw(context) {
            super.draw(context);
            this.buildingPlots.forEach(buildingPlot => {
                buildingPlot.draw(context);
            });
        }

        update() {
            super.update();
            this.buildingPlots.forEach(buildingPlot => {
                buildingPlot.update();
            });
        }
    }

    class BuildingPlot {
        constructor(isPlayer, x) {
            this.isPlayer = isPlayer;
            this.image = document.getElementById("plankImage");
            this.width = 200;
            this.height = 20;
            this.y = gameHeight - this.height - gameFloor;

            if (this.isPlayer) {
                this.x = x;
            } else {
                this.x = x - this.width;
            }

            this.building = null;

            this.buildButtonImage = document.getElementById("plusIconImage");
            this.buildButtonWidth = this.width / 2;
            this.buildButtonHeight = this.buildButtonWidth;
            this.buildButtonX = this.x + this.buildButtonWidth / 2;
            this.buildButtonY = this.y - this.buildButtonHeight * 1.5;

            this.buildButtonClicked = false;
            this.buildingButtonsCount = 6;
            this.buildingButtons = [];

            for (let i = 0; i < this.buildingButtonsCount; i++) {
                this.buildingButtons.push(new BuildingButton(i, this.x, this.y, this.width, this.height));
            }
        }

        draw(context) {
            if (this.building == null && this.isPlayer) {
                if (this.buildButtonClicked) {
                    this.buildingButtons.forEach(buildingButton => buildingButton.draw(context));
                } else {
                    context.drawImage(this.buildButtonImage, this.buildButtonX, this.buildButtonY, this.buildButtonWidth, this.buildButtonHeight);
                }
            } else if (this.building != null) {
                this.building.draw(context);
            }
            context.drawImage(this.image, this.x, this.y, this.width, this.height);
        }

        update() {
            if (this.building != null) {
                this.building.update();
            }
            this.buildButtonX += cameraSpeed;
            this.buildingButtons.forEach(buildingButton => buildingButton.update());
            this.x += cameraSpeed;
        }

        handleClick(x, y) {
            if (
                x >= this.buildButtonX && x <= this.buildButtonX + this.buildButtonWidth &&
                y >= this.buildButtonY && y <= this.buildButtonY + this.buildButtonHeight &&
                !this.buildButtonClicked
            ) {
                this.buildButtonClicked = true;
                return;
            }

            let clickedOnBuildingButton = false;
            this.buildingButtons.forEach(buildingButton => {
                if (buildingButton.handleClick(x, y)) {
                    clickedOnBuildingButton = true;
                }
            });

            if (!clickedOnBuildingButton) {
                this.buildButtonClicked = false;
            }
        }
    }

    class BuildingButton {
        constructor(idNumber, plotX, plotY, plotWidth) {
            this.idNumber = idNumber;

            this.width = plotWidth / 3;
            this.height = this.width;

            this.padding = this.width / 5;

            this.x = plotX + (plotWidth / 2) - this.width - (this.padding / 2);
            this.y = plotY - this.padding;

            this.clicked = false;

            switch (this.idNumber) {
                case 0:
                    this.y -= this.width;
                    this.image = document.getElementById("farmIconImage");
                    break;
                case 1:
                    this.y -= this.width;
                    this.x += this.width + this.padding;
                    this.image = document.getElementById("houseIconImage");
                    break;
                case 2:
                    this.y -= 2 * this.width + this.padding;
                    this.image = document.getElementById("shieldIconImage");
                    break;
                case 3:
                    this.y -= 2 * this.width + this.padding;
                    this.x += this.width + this.padding;
                    this.image = document.getElementById("mineIconImage");
                    break;
                case 4:
                    this.y -= 3 * this.width + (this.padding * 2);
                    this.image = document.getElementById("towerIconImage");
                    break;
                case 5:
                    this.y -= 3 * this.width + (this.padding * 2);
                    this.x += this.width + this.padding;
                    this.image = document.getElementById("sawmillIconImage");
                    break;
            }
        }

        draw(context) {
            context.drawImage(this.image, this.x, this.y, this.width, this.height);

            if (this.clicked) {
                context.strokeStyle = "green";
                context.lineWidth = 5;
                context.strokeRect(
                    this.x, 
                    this.y, 
                    this.width, 
                    this.height);
            } else {
                context.strokeStyle = "black";
                context.lineWidth = 2.5;
                context.strokeRect(
                    this.x, 
                    this.y, 
                    this.width, 
                    this.height);
            }
        }

        update() {
            this.x += cameraSpeed;
        }

        handleClick(x, y) {
            if (
                x >= this.x && x <= this.x + this.width &&
                y >= this.y && y <= this.y + this.height
            ) {
                this.clicked = true;
                return true;
            } else {
                this.clicked = false;
                return false;
            }
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
            this.gravity = 0.981;
            this.deleteable = false;
        }

        draw(context) {
            context.fillStyle = "white";
            if (this.dealer.strength * 2 == this.damage) {
                context.fillStyle = "red";
            }
            let fontSize = 30 * (this.damage / this.dealer.strength);
            context.font = fontSize + "px Helvetica";
            context.strokeStyle = "black";
            context.lineWidth = 2;
        
            context.strokeText(Math.round(this.damage), this.x, this.y);
            context.fillText(Math.round(this.damage), this.x, this.y);
        }

        update() {
            this.x += this.xScale + cameraSpeed;
            this.y -= this.yScale;
            this.yScale -= this.gravity;
            if (this.y > gameHeight) {
                this.deleteable = true;
            }
        }
    }

    class Resources {
        constructor(food, wood, stone, horses, metal) {
            this.food = food;
            this.wood = wood;
            this.stone = stone;
            this.horses = horses;
            this.metal = metal;
        }

        deductOrFail(resourcesCost) {
            if (
                this.food >= resourcesCost.food &&
                this.wood >= resourcesCost.wood &&
                this.stone >= resourcesCost.stone &&
                this.horses >= resourcesCost.horses &&
                this.metal >= resourcesCost.metal
            ) {
                this.food -= resourcesCost.food;
                this.wood -= resourcesCost.wood;
                this.stone -= resourcesCost.stone;
                this.horses -= resourcesCost.horses;
                this.metal -= resourcesCost.metal;
                return true;
            } else {
                return false;
            }
        }

        increaseAllByPercent(percent) {
            this.food *= (1 + (percent / 100));
            this.wood *= (1 + (percent / 100));
            this.stone *= (1 + (percent / 100));
            this.horses *= (1 + (percent / 100));
            this.metal *= (1 + (percent / 100));
        }
    }

    class Team {
        constructor(isPlayer, username) {
            this.isPlayer = isPlayer;
            this.username = username;
            this.castle = new Castle(isPlayer);

            this.era = 0;
            this.eraXP = 0;
            this.eraXPMax = 1000;

            this.resources = new Resources(10, 10, 10, 0, 0);

            this.housing = 0;
            this.housingMax = 5;

            if (this.isPlayer) {
                this.updateUnitSpawnButtons();
            }
        }

        draw(context) {
            this.castle.draw(context);
        }

        update() {
            this.castle.update();

            if (this.eraXP >= this.eraXPMax) {
                this.era++;
                this.eraXP = 0;
                this.eraXPMax *= (1 + (2 / 3));

                if (this.isPlayer) {
                    this.updateUnitSpawnButtons();
                }
            }
        }

        getUnits() {
            switch (this.era) {
                case 0:
                    return [
                        new SoldierType("Smasher", 2, 2, 1, 1, 1, "soldierImage", new Resources(1, 0, 1, 0, 0)),
                        new SoldierType("Thrower", 1, 1, 2, 2, 3, "soldierImage", new Resources(1, 1, 0, 0, 0))
                    ];
                case 1:
                    return [
                        new SoldierType("Smasher", 2, 2, 1, 1, 1, "soldierImage", new Resources(1, 0, 1, 0, 0)),
                        new SoldierType("Thrower", 1, 1, 2, 2, 3, "soldierImage", new Resources(1, 1, 0, 0, 0))
                    ];
                case 2:
                    return [
                        new SoldierType("Smasher", 2, 2, 1, 1, 1, "soldierImage", new Resources(1, 0, 1, 0, 0)),
                        new SoldierType("Thrower", 1, 1, 2, 2, 3, "soldierImage", new Resources(1, 1, 0, 0, 0))
                    ];
                case 3: 
                    return [
                        new SoldierType("Smasher", 2, 2, 1, 1, 1, "soldierImage", new Resources(1, 0, 1, 0, 0)),
                        new SoldierType("Thrower", 1, 1, 2, 2, 3, "soldierImage", new Resources(1, 1, 0, 0, 0))
                    ];
                case 4:
                    return [
                        new SoldierType("Smasher", 2, 2, 1, 1, 1, "soldierImage", new Resources(1, 0, 1, 0, 0)),
                        new SoldierType("Thrower", 1, 1, 2, 2, 3, "soldierImage", new Resources(1, 1, 0, 0, 0))
                    ];
            }
        }

        updateUnitSpawnButtons() {
            let unitContainer = document.getElementById("troopsContainer");
            unitContainer.innerHTML = "";

            let units = this.getUnits();
            let team = this;
            units.forEach(unit => {
                let spawnButton = document.createElement("button");
                spawnButton.textContent = unit.name + " Level: " + unit.level + " (" + unit.xp + "/" + unit.xpMax + ")";
                spawnButton.id = unit.name;
                spawnButton.addEventListener("click", function() {
                    team.handleSoldierTypeClick(unit, team);
                });

                unitContainer.appendChild(spawnButton);
            });
        }

        handleSoldierTypeClick(soldierType, team) {
            // Clear canvas clicks
            this.castle.buildingPlots.forEach(plot => {
                plot.buildButtonClicked = false;
                plot.buildingButtons.forEach(button => {
                    button.clicked = false;
                });
            });

            let dialogueTitle = document.getElementById("dialogueTitle");
            dialogueTitle.innerHTML = "Unit: " + soldierType.name;

            let dialogueContent = document.getElementById("dialogueContent");
            dialogueContent.innerHTML = getSoldierTypeString(soldierType);

            let dialogueButtons = document.getElementById("dialogueButtons");
            dialogueButtons.innerHTML = "";

            let spawnButton = document.createElement("button");
            spawnButton.innerHTML = "Spawn";
            spawnButton.addEventListener("click", function() {
                team.handleSpawnSoldierClick(soldierType);
            });

            dialogueButtons.appendChild(spawnButton);
        }

        handleSpawnSoldierClick(soldierType) {
            if (this.resources.deductOrFail(soldierType.resourcesCost)) {
                soldiers.push(new Soldier(true, soldierType, this.castle));
            }
        }
    }

    function getSoldierTypeString(soldierType) {
        return "Str: " + soldierType.strength +
        " Agi: " + soldierType.agility +
        " Vit: " + soldierType.vitality + 
        " Luk: " + soldierType.luck + 
        " Range: " + soldierType.range + ".";
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
    const background = new Background();

    let playerTeam = new Team(true, "johndoe");
    let enemyTeam = new Team(false, "janedoe");
    let soldiers = [];

    function updateUI() {
        // Update player username
        let playerName = playerTeam.username;
        document.getElementById("playerName").innerText = playerName;

        // Update enemy username
        let enemyName = enemyTeam.username;
        document.getElementById("enemyName").innerText = enemyName;

        // Update player healthbar
        let playerHP = playerTeam.castle.hp;
        let playerHPMax = playerTeam.castle.maxHP;
        document.getElementById("playerHealthbar").innerText = playerHP + " / " + playerHPMax;

        // Update enemy healthbar
        let enemyHP = enemyTeam.castle.hp;
        let enemyHPMax = enemyTeam.castle.maxHP;
        document.getElementById("enemyHealthbar").innerText = enemyHP + " / " + enemyHPMax;

        // Update player erabar
        let playerEra = getEraString(playerTeam.era);
        let playerEraXP = playerTeam.eraXP;
        let playerEraXPMax = playerTeam.eraXPMax;
        document.getElementById("playerEra").innerText = playerEra;
        document.getElementById("playerEraProgress").innerText = playerEraXP + " / " + playerEraXPMax;

        // Update enemy erabar
        let enemyEra = getEraString(enemyTeam.era);
        let enemyEraXP = enemyTeam.eraXP;
        let enemyEraXPMax = enemyTeam.eraXPMax;
        document.getElementById("enemyEra").innerText = enemyEra;
        document.getElementById("enemyEraProgress").innerText = enemyEraXP + " / " + enemyEraXPMax;

        // Update resources
        document.getElementById("foodCount").innerText = playerTeam.resources.food;
        document.getElementById("woodCount").innerText = playerTeam.resources.wood;
        document.getElementById("stoneCount").innerText = playerTeam.resources.stone;
        document.getElementById("horsesCount").innerText = playerTeam.resources.horses;
        document.getElementById("metalCount").innerText = playerTeam.resources.metal;

        // Update housing
        document.getElementById("housingBar").innerText = playerTeam.housing + "/ " + playerTeam.housingMax;
    }

    function getEraString(era) {
        switch (era) {
            case 0:
                return "I";
            case 1:
                return "II";
            case 2:
                return "III";
            case 3: 
                return "IV";
            case 4:
                return "V";
        }
    }

    let prevTimestamp = 0;

    function animate(timestamp) {
        const deltaTimestamp = timestamp - prevTimestamp;
        prevTimestamp = timestamp;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        background.draw(ctx);
        background.update(input);

        let teams = [playerTeam, enemyTeam];

        teams.forEach(team => {
            team.draw(ctx);
            team.update();
        });
        
        soldiers.forEach(soldier => {
            soldier.draw(ctx);
            soldier.update(deltaTimestamp, soldiers, teams);
        });
        soldiers = soldiers.filter(soldier => soldier.hp > 0);

        updateUI();

        requestAnimationFrame(animate);
    }

    animate(0);

    function addAllEventListeners() {
        // Add canvas click listener
        canvas.addEventListener("click", function(event) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            playerTeam.castle.buildingPlots.forEach(plot => {
                    plot.handleClick(x, y);
            });
        });
    }

    addAllEventListeners();
});