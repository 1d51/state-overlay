/*:
 * @author 1d51
 * @version 0.0.6
 * @plugindesc Use custom overlays based on actor states
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 * 
 * This plugin reads information from a configuration file placed at the root
 * of the game files (inside the www folder) called "stateoverlay.json". It uses
 * that to intercept when a face is drawn, and adds overlays on top. It relies on
 * the face image files having something in their name that can be mapped to an actor.
 */

var Imported = Imported || {};
Imported.StateOverlay = true;

var StateOverlay = StateOverlay || {};

StateOverlay.fs = require('fs');

StateOverlay.Helpers = StateOverlay.Helpers || {};
StateOverlay.Params = StateOverlay.Params || {};
StateOverlay.Holders = StateOverlay.Holders || {};

(function ($) {

    $.Helpers.createPath = function (wrath) {
        const oldVersion = window.location.pathname !== "/index.html";
        oldVersion && (wrath = "/" + wrath);
        wrath += (wrath === "") ? "./" : "/";
        !(Utils.isNwjs() && Utils.isOptionValid("test")) && (wrath = "www/" + wrath);
        let path = window.location.pathname.replace(/(\/www|)\/[^\/]*$/, wrath);
        if (path.match(/^\/([A-Z]\:)/)) path = path.slice(1);
        path = decodeURIComponent(path);
        return path;
    };

    /************************************************************************************/

    $.Params.root = $.Helpers.createPath("");

    $.findOverlays = function (actor) {
        if (actor == null) return [[], [], false];
        const inputs = $.readConfig()["inputs"];

        inputs.sort((a, b) => {
            if (a["priority"] == null) return 1;
            if (b["priority"] == null) return -1;
            return a["priority"] - b["priority"];
        });

        const append = [];
        const prepend = [];
        let replace = false;
        for (let i = 0; i < inputs.length; i++) {
            const mode = inputs[i]["mode"] || "replace";
            const conditions = inputs[i]["conditions"];
            const allowed = conditions.every(condition => {
                let inclusive = condition["inclusive"];
                if (inclusive == null) inclusive = true;
                const type = condition["type"] || "state";
                const text = condition["text"];
                const id = condition["id"];

                let response = false;
                if (type === "switch") response = $gameSwitches.value(id);
                else if (type === "actor") response = id === actor._actorId;
                else if (type === "class") response = actor.isClass($dataClasses[id]);
                else if (type === "skill") response = actor.hasSkill(id);
                else if (type === "armor") response = actor.hasArmor($dataArmors[id]);
                else if (type === "weapon") response = actor.hasWeapon($dataArmors[id]);
                else if (type === "state") response = actor.isStateAffected(id);
                else if (type === "contains") response = actor.faceName().includes(text);
                return inclusive ? response : !response;
            });

            if (allowed) {
                if (mode === "prepend") {
                    prepend.push(inputs[i]);
                } else if (mode === "append") {
                    append.push(inputs[i]);
                } else if (mode === "replace") {
                    append.push(inputs[i]);
                    replace = true;
                }
            }
        }

        return [prepend, append, replace];
    };

    $.findActor = function (faceName) {
        const factors = this.readConfig()["factors"];
        const keys = Object.keys(factors);

        for (let i = 0; i < keys.length; i++) {
            if (faceName.includes(keys[i])) {
                const actorId = factors[keys[i]];
                return $gameActors.actor(actorId);
            }
        }

        return null;
    };

    $.readConfig = function () {
        const path = $.Params.root + "stateoverlay.json";
        if ($.fs.existsSync(path)) {
            const file = $.fs.readFileSync(path);
            return JSON.parse(file);
        } else {
            return {
                "inputs": [],
                "factors": {}
            };
        }
    };

    /************************************************************************************/

    $.Holders.drawFace = Window_Base.prototype.drawFace;
    Window_Base.prototype.drawFace = function (faceName, faceIndex, x, y, width, height) {
        const actor = StateOverlay.findActor(faceName);
        const overlays = StateOverlay.findOverlays(actor);
        for (let i = 0; i < overlays[0].length; i++) {
            const dxf = actor._actorId - 1 < overlays[0][i]["dxf"].length
                ? overlays[0][i]["dxf"][actor._actorId - 1] : 0;
            const dyf = actor._actorId - 1 < overlays[0][i]["dyf"].length
                ? overlays[0][i]["dyf"][actor._actorId - 1] : 0;
            $.Holders.drawFace.call(this, overlays[0][i]["name"], faceIndex, x + dxf, y + dyf, width, height);
        }
        if (!overlays[2]) {
            $.Holders.drawFace.call(this, faceName, faceIndex, x, y, width, height);
        }
        for (let i = 0; i < overlays[1].length; i++) {
            const dxf = actor._actorId - 1 < overlays[1][i]["dxf"].length
                ? overlays[1][i]["dxf"][actor._actorId - 1] : 0;
            const dyf = actor._actorId - 1 < overlays[1][i]["dyf"].length
                ? overlays[1][i]["dyf"][actor._actorId - 1] : 0;
            $.Holders.drawFace.call(this, overlays[1][i]["name"], faceIndex, x + dxf, y + dyf, width, height);
        }
    };

    if (Imported.YEP_SaveCore) {
        $.Holders.saveDrawFace = Window_SaveInfo.prototype.drawFace;
        Window_SaveInfo.prototype.drawFace = function(name, index, x, y, w, h) {
            const actor = StateOverlay.findActor(name);
            const overlays = StateOverlay.findOverlays(actor);
            for (let i = 0; i < overlays[0].length; i++) {
                const dxf = actor._actorId - 1 < overlays[0][i]["dxf"].length
                    ? overlays[0][i]["dxf"][actor._actorId - 1] : 0;
                const dyf = actor._actorId - 1 < overlays[0][i]["dyf"].length
                    ? overlays[0][i]["dyf"][actor._actorId - 1] : 0;
                $.Holders.saveDrawFace.call(this, overlays[0][i]["name"], index, x + dxf, y + dyf, w, h);
            }
            if (!overlays[2]) {
                $.Holders.saveDrawFace.call(this, name, index, x, y, w, h);
            }
            for (let i = 0; i < overlays[1].length; i++) {
                const dxf = actor._actorId - 1 < overlays[1][i]["dxf"].length
                    ? overlays[1][i]["dxf"][actor._actorId - 1] : 0;
                const dyf = actor._actorId - 1 < overlays[1][i]["dyf"].length
                    ? overlays[1][i]["dyf"][actor._actorId - 1] : 0;
                $.Holders.saveDrawFace.call(this, overlays[1][i]["name"], index, x + dxf, y + dyf, w, h);
            }
        };
    }

    if (Imported.YEP_BattleStatusWindow) {
        $.Holders.battleDrawFace = Window_BattleStatus.prototype.drawFace;
        Window_BattleStatus.prototype.drawFace = function(fn, fi, x, y, width, height) {
            const actor = StateOverlay.findActor(fn);
            const overlays = StateOverlay.findOverlays(actor);
            for (let i = 0; i < overlays[0].length; i++) {
                const dxf = actor._actorId - 1 < overlays[0][i]["dxf"].length
                    ? overlays[0][i]["dxf"][actor._actorId - 1] : 0;
                const dyf = actor._actorId - 1 < overlays[0][i]["dyf"].length
                    ? overlays[0][i]["dyf"][actor._actorId - 1] : 0;
                $.Holders.battleDrawFace.call(this, overlays[0][i]["name"], fi, x + dxf, y + dyf, width, height);
            }
            if (!overlays[2]) {
                $.Holders.battleDrawFace.call(this, fn, fi, x, y, width, height);
            }
            for (let i = 0; i < overlays[1].length; i++) {
                const dxf = actor._actorId - 1 < overlays[1][i]["dxf"].length
                    ? overlays[1][i]["dxf"][actor._actorId - 1] : 0;
                const dyf = actor._actorId - 1 < overlays[1][i]["dyf"].length
                    ? overlays[1][i]["dyf"][actor._actorId - 1] : 0;
                $.Holders.battleDrawFace.call(this, overlays[1][i]["name"], fi, x + dxf, y + dyf, width, height);
            }
        };
    }

    if (Imported.Galv_BustMenu) {
        $.Holders.bustDrawFace = Window_MenuStatus.prototype.drawFace;
        Window_MenuStatus.prototype.drawFace = function (faceName, faceIndex, x, y, width, height) {
            const actor = StateOverlay.findActor(faceName);
            const overlays = StateOverlay.findOverlays(actor);
            for (let i = 0; i < overlays[0].length; i++) {
                const dxp = actor._actorId - 1 < overlays[0][i]["dxp"].length
                    ? overlays[0][i]["dxp"][actor._actorId - 1] : 0;
                const dyp = actor._actorId - 1 < overlays[0][i]["dyp"].length
                    ? overlays[0][i]["dyp"][actor._actorId - 1] : 0;
                $.Holders.bustDrawFace.call(this, overlays[0][i]["name"], faceIndex, x + dxp, y + dyp, width, height);
            }
            if (!overlays[2]) {
                $.Holders.bustDrawFace.call(this, faceName, faceIndex, x, y, width, height);
            }
            for (let i = 0; i < overlays[1].length; i++) {
                const dxp = actor._actorId - 1 < overlays[1][i]["dxp"].length
                    ? overlays[1][i]["dxp"][actor._actorId - 1] : 0;
                const dyp = actor._actorId - 1 < overlays[1][i]["dyp"].length
                    ? overlays[1][i]["dyp"][actor._actorId - 1] : 0;
                $.Holders.bustDrawFace.call(this, overlays[1][i]["name"], faceIndex, x + dxp, y + dyp, width, height);
            }
        };
    }

})(StateOverlay);