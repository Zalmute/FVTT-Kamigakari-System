// Import Modules

import { KamigakariItemSheet } from "./item-sheet.js";
import { KamigakariActorSheet } from "./actor-sheet.js";
import { InfluenceDialog } from "./influence-dialog.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
	console.log('Initializing Kamigakri System.');
	
	game.kamigakari = {
		influence,
		setSpiritDice
	  };

    CONFIG.Dice.tooltip = "systems/kamigakari/templates/dice/tooltip.html";

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("kamigakari", KamigakariActorSheet, { makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("kamigakari", KamigakariItemSheet, {makeDefault: true});

    // Patch Core Functions
    Combat.prototype._getInitiativeFormula = function(combatant) {
        const actor = combatant.actor;
        const init = actor.data.data.attributes.init.value;

        return "" + init;
    };

});

Hooks.on('createActor', async (actor, options, id) => {
	await actor.update({ 'data.details.look': game.i18n.localize("KG.LookDefault"), 
		'data.details.spirit_look': game.i18n.localize("KG.SpiritLookDefault"),
		'data.details.basic': game.i18n.localize("KG.EnermyDefault")  });
});

Hooks.on("canvasInit", function() {
	SquareGrid.prototype.measureDistances = function(segments) {
		// Track the total number of diagonals
		let nDiagonal = 0;
		const rule = this.parent.diagonalRule;
		const d = canvas.dimensions;
	  
		// Iterate over measured segments
		return segments.map(s => {
			let r = s.ray;

			// Determine the total distance traveled
			let nx = Math.abs(Math.ceil(r.dx / d.size));
			let ny = Math.abs(Math.ceil(r.dy / d.size));

			// Determine the number of straight and diagonal moves
			let nd = Math.min(nx, ny);
			let ns = Math.abs(ny - nx);
			nDiagonal += nd;
		
			let spaces = nd * 2 + ns;
			return spaces * canvas.dimensions.distance;
		});
	};
});

async function setSpiritDice() {
	const speaker = ChatMessage.getSpeaker();
	let actor;
	if (speaker.token) actor = game.actors.tokens[speaker.token];
	if (!actor) actor = game.actors.get(speaker.actor);

	if (actor == null) {
		alert("You must use actor");
		return;
	}

	var answer = prompt("Whay do you want to change?\n ex) 4, 5");
	if (!isNaN(answer) && answer != null && answer >= 1) {
		actor.update({'data.attributes.spirit_dice.value': 0 })
		await actor.update({'data.attributes.spirit_dice.value': {} });
		for (var i = 0; i < answer; i++)
			await actor.update({[`data.attributes.spirit_dice.value.[${i}]`]: 0});
	}

}

function influence() {
	const speaker = ChatMessage.getSpeaker();
	let actor;
	if (speaker.token) actor = game.actors.tokens[speaker.token];
	if (!actor) actor = game.actors.get(speaker.actor);

	if (actor == null) {
		alert("You must use actor");
		return;
	}

	var m = game.messages["entities"].filter(element => element.data.speaker.alias == actor.data.name && element.data.content.indexOf("<span class=\"dice-rolls\">") != -1);

	if (m.length == 0) {
		alert("Unusual Approach.");
		return;
	}
	var d = $(m[m.length - 1].data.content);
	var modScore = d.find(".dice-total").text() - d.find(".part-total").text();

	var actionDice = [];
	var spiritDice = actor.data.data.attributes.spirit_dice.value;

	var dices = d.find("img");
	dices.each(function() {
		actionDice.push($(this).attr("data-dice"));
	});

	let dialog = new InfluenceDialog(actionDice, spiritDice, actor, modScore);
	dialog.render(true);
}
