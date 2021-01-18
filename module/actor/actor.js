

export class KamigakariActor extends Actor {

  prepareData() {
    super.prepareData();

    const actorData = this.data;
    if (actorData.type === 'character') this._prepareCharacterData();
  }

  _prepareCharacterData() {
    let values = {
      "str": { "value": this.data.data.attributes.str.add },
      "agi": { "value": this.data.data.attributes.agi.add },
      "int": { "value": this.data.data.attributes.int.add },
      "wil": { "value": this.data.data.attributes.wil.add },
      "lck": { "value": this.data.data.attributes.lck.add },
      "str_roll": { "value": 0 },
      "agi_roll": { "value": 0 },
      "int_roll": { "value": 0 },
      "wil_roll": { "value": 0 },
      "lck_roll": { "value": 0 },
      "acc": { "value": 0 },
      "eva": { "value": 0 },
      "cnj": { "value": 0 },
      "res": { "value": 0 },
      "ins": { "value": 0 },
      "pd": { "value": 0 },
      "md": { "value": 0 },
      "init": { "value": 0 },
      "armor": { "value": 0 },
      "barrier": { "value": 0 },
      "hp": { "value": 0 },
      "rank": { "value": 0 },
      "base": { "value": 0 },
      "add": { "value": 0 },
      "rangePD": { "value": 0 }
    }

    let race = null;
    let mainStyle = null;
    let roll = '-';
    let talents = [];
    let equipment = [];

    for (let i of this.items) {
      if (i.type == 'race')
        race = i;
      else if (i.type == 'style' && i.data.data.main)
        mainStyle = i;
      else if (i.type == 'talent' && i.data.data.active)
        talents.push(i);
      else if (i.type == 'equipment')
        equipment.push(i);
    }

    if (race != null)
      values = this._updateData(values, race.data.data.attributes[race.data.data.type]);

    if (mainStyle != null)
      values = this._updateData(values, mainStyle.data.data.attributes);

    for (var item of talents) {
      values = this._updateData(values, item.data.data.attributes);
      roll = (item.data.data.roll != undefined && item.data.data.roll != '-') ? item.data.data.roll : roll;
    }

    values["acc"].value += values["str"].value;
    values["eva"].value += values["agi"].value;
    values["cnj"].value += values["int"].value;
    values["res"].value += values["wil"].value;
    values["ins"].value += values["lck"].value;

    values["pd"].value += Math.ceil(values["str"].value / 2)
    values["md"].value += Math.ceil(values["int"].value / 2)
    values["init"].value += values["agi"].value + 5;
    values["hp"].value += values["str"].value + values["wil"].value + this.data.data.attributes.level.value * 3;

    values["base"].value = (values["base"].value == 0) ? 1 : values["base"].value;

    for (var item of equipment)
      values = this._updateData(values, item.data.data.attributes);

    if (values["rangePD"].value != 0)
        values["pd"].value = values["rangePD"].value;
    delete values.rangePD;

    this.data.data.attributes.move.battle = Math.ceil( (values['init'].value + 5) / 3 );
    this.data.data.attributes.move.full = values['init'].value + 5;

    this.data.data.attributes.hp.max = values.hp.value;
    delete values.hp;

    if (this.data.data.attributes.damage.auto) {
      this.data.data.attributes.damage.base = values.base.value;
      this.data.data.attributes.damage.rank = values.base.value + values.rank.value;
      this.data.data.attributes.damage.rank += (this.data.data.attributes.destruction != undefined) ? this.data.data.attributes.destruction.value : 0;
      this.data.data.attributes.damage.rank = (this.data.data.attributes.damage.rank > 10) ? 10 : this.data.data.attributes.damage.rank

      this.data.data.attributes.damage.add = values.add.value;

      if (roll == 'acc')
        this.data.data.attributes.damage.add += values["pd"].value;
      else if (roll == 'cnj')
        this.data.data.attributes.damage.add += values["md"].value;
    }
    delete values.base;
    delete values.rank;
    delete values.add;

    this.data.data.attributes['str'].roll = values["str_roll"].value;
    this.data.data.attributes['agi'].roll = values["agi_roll"].value;
    this.data.data.attributes['int'].roll = values["int_roll"].value;
    this.data.data.attributes['wil'].roll = values["wil_roll"].value;
    this.data.data.attributes['lck'].roll = values["lck_roll"].value;

    delete values.str_roll;
    delete values.agi_roll;
    delete values.int_roll;
    delete values.wil_roll;
    delete values.lck_roll;

    console.log(values);

    for (const [key, value] of Object.entries(values))
      this.data.data.attributes[key].value = value.value;

    this.activeTalent = talents;
  }

  _updateData(values, attributes) {
    for (const [key, value] of Object.entries(attributes))
      if (key != '-')
        values[key].value += value.value;

    return values;
  }


  async _rollDice(a, l) {
    let dice = null;
    let formula = null;
    let flavorText = null;
    let templateData = {};

    const actorData = this.data.data;
    const ability = actorData.attributes[a];
    dice = ability.dice;
    formula = `${dice}6+${ability.value}`;
    if (ability.roll != undefined)
        formula += '+' + ability.roll;

    if (actorData.attributes.transcend != null && actorData.attributes.transcend.value != 0) {
      formula = Number(actorData.attributes.transcend.value) + Number(dice.charAt(0)) + "D6 + " + ability.value;
      await this.update({'data.attributes.transcend.value': 0});
    }

    templateData = {
      title: l
    };

    // Render the roll.
    let template = 'systems/kamigakari/templates/chat/chat-move.html';
    // GM rolls.
    let chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this })
    };

    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    let roll = new Roll(formula);
    roll.roll();

    let high = 0, count = 0;
    for (let side of roll.terms[0].results) {
      high = (side.result > high) ? side.result : high;
      count += (side.result == 6) ? 1 : 0;
    }

    high = (count >= 2) ? 10 : high;
    await this.update({"data.attributes.damage.high": high});

    roll.render().then(r => {
      templateData.rollDw = r;
      renderTemplate(template, templateData).then(content => {
        chatData.content = content;
        if (game.dice3d) {
          game.dice3d.showForRoll(roll, chatData.whisper, chatData.blind).then(displayed => ChatMessage.create(chatData));
        }
        else {
          chatData.sound = CONFIG.sounds.dice;
          ChatMessage.create(chatData);
        }
      });
    });
  }

  async _rollDamage() {
    const actorData = this.data.data;
    let formula = actorData.attributes.damage.high + " * " + actorData.attributes.damage.rank + " + " + actorData.attributes.damage.add  
    let roll = new Roll(formula, this.getRollData());
    roll.roll();

    let chatData = {"content": await roll.render(), "speaker": ChatMessage.getSpeaker({ actor: this.actor })};
    ChatMessage.create(chatData);

    await this.update({"data.attributes.destruction.value": 0});

    for (let item of this.activeTalent)
      if (item.data.data.disable == 'damage')
        item.update({"data.active": false});
  }

  _echoItemDescription(itemId) {
    const item = this.getOwnedItem(itemId);

    let title = item.data.name;
    let description = item.data.data.description;

    if (item.data.type == 'talent') {
      if (item.data.img != 'icons/svg/mystery-man.svg')
        title = `<img src="${item.data.img}" width="40" height="40">&nbsp&nbsp${title}` 

      description = `<table style="text-align: center;">
                      <tr>
                        <th>${game.i18n.localize("KG.Timing")}</th>
                        <th>${game.i18n.localize("KG.Range")}</th>
                        <th>${game.i18n.localize("KG.Target")}</th>
                        <th>${game.i18n.localize("KG.Cost")}</th>
                      </tr>

                      <tr>
                        <td>${item.data.data.timing}</td>
                        <td>${item.data.data.range}</td>
                        <td>${item.data.data.target}</td>
                        <td>${item.data.data.cost}</td>
                      </tr>
                    </table>${description}`
      description += `<button type="button" class="use-talent" data-actor-id="${this.id}" data-item-id="${item.id}">${game.i18n.localize("KG.UseTalent")}</button>`

      if (item.data.data.roll != '-')
        description += `<button type="button" class="calc-damage" data-actor-id="${this.id}" >${game.i18n.localize("KG.CalcDamage")}</button>`
    }

    // Render the roll.
    let template = 'systems/kamigakari/templates/chat/chat-move.html';
    let templateData = {
      title: title,
      details: description
    };

    // GM rolls.
    let chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this })
    };

    renderTemplate(template, templateData).then(content => {
      chatData.content = content;
      ChatMessage.create(chatData);
    });

  }

}