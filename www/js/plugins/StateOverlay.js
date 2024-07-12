/*:
 * @author 1d51
 * @version 0.0.9
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
        const replace = [];
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
                else if (type === "contains") response = replace.length > 0
                    ? replace[replace.length - 1]["name"].includes(text)
                    : actor.faceName().includes(text);

                return inclusive ? response : !response;
            });

            if (allowed) {
                if (mode === "prepend") {
                    prepend.push(inputs[i]);
                } else if (mode === "append") {
                    append.push(inputs[i]);
                } else if (mode === "combine") {
                    replace.push(inputs[i]);
                } else if (mode === "replace") {
                    replace.push(inputs[i]);
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

    $.unpackParameters = function (actor, object) {
        const dxf = object["dxf"] != null &&
                actor._actorId - 1 < object["dxf"].length
            ? object["dxf"][actor._actorId - 1] : 0;

        const dyf = object["dyf"] != null &&
                actor._actorId - 1 < object["dyf"].length
            ? object["dyf"][actor._actorId - 1] : 0;

        const dxp = object["dxp"] != null &&
                actor._actorId - 1 < object["dxp"].length
            ? object["dxp"][actor._actorId - 1] : 0;

        const dyp = object["dyp"] != null &&
                actor._actorId - 1 < object["dyp"].length
            ? object["dyp"][actor._actorId - 1] : 0;

        const wf = object["wf"] != null &&
                actor._actorId - 1 < object["wf"].length
            ? object["wf"][actor._actorId - 1] : 0;

        const hf = object["hf"] != null &&
                actor._actorId - 1 < object["hf"].length
            ? object["hf"][actor._actorId - 1] : 0;

        const wp = object["wp"] != null &&
                actor._actorId - 1 < object["wp"].length
            ? object["wp"][actor._actorId - 1] : 0;

        const hp = object["hp"] != null &&
                actor._actorId - 1 < object["hp"].length
            ? object["hp"][actor._actorId - 1] : 0;

        return [dxf, dyf, dxp, dyp, wf, hf, wp, hp];
    }

    /************************************************************************************/

    Window_Base.prototype.customDrawFace = function(n, fi, sw, sh, dx, dy) {
        const bitmap = ImageManager.loadFace(n);
        const pw = Window_Base._faceWidth;
        const ph = Window_Base._faceHeight;

        if (bitmap.width <= 0) {
            return setTimeout(this.customDrawFace.bind(this, n, fi, sw, sh, dx, dy), 50);
        }

        sw = sw || Window_Base._faceWidth;
        sh = sh || Window_Base._faceHeight;

        sw = Math.min(sw, pw);
        sh = Math.min(sh, ph);

        const sx = fi % 4 * pw + (pw - sw) / 2;
        const sy = Math.floor(fi / 4) * ph + (ph - sh) / 2;

        dx = Math.floor(dx + Math.max(sw - pw, 0) / 2) - 2;
        dy = Math.floor(dy + Math.max(sh - ph, 0) / 2) - 4;
        this.contents.blt(bitmap, sx, sy, sw, sh, dx, dy);
    };

    $.Holders.drawFace = Window_Base.prototype.drawFace;
    Window_Base.prototype.drawFace = function (name, index, x, y, w, h) {
        const actor = StateOverlay.findActor(name);
        const [prepend, append, replace] = StateOverlay.findOverlays(actor);

        for (let i = 0; i < prepend.length; i++) {
            const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, prepend[i]);
            $.Holders.drawFace.call(this, prepend[i]["name"], index, x + dxf, y + dyf, wf || w, hf || h);
        }
        if (replace.length > 0) {
            const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, replace[replace.length - 1]);
            $.Holders.drawFace.call(this, replace[replace.length - 1]["name"], index, x, y, w, h);

            if (replace[replace.length - 1]["mode"] === "combine") {
                this.customDrawFace(name, index, wf || w, hf || h, x + dxf, y + dyf);
            }
        } else {
            $.Holders.drawFace.call(this, name, index, x, y, w, h);
        }
        for (let i = 0; i < append.length; i++) {
            const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, append[i]);
            $.Holders.drawFace.call(this, append[i]["name"], index, x + dxf, y + dyf, wf || w, hf || h);
        }
    };

    if (Imported.YEP_BattleStatusWindow) {
        Window_BattleStatus.prototype.customDrawFace = function(n, fi, sw, sh, dx, dy) {
            const bitmap = ImageManager.loadFace(n);
            const pw = Window_Base._faceWidth;
            const ph = Window_Base._faceHeight;

            if (bitmap.width <= 0) {
                return setTimeout(this.customDrawFace.bind(this, n, fi, sw, sh, dx, dy), 50);
            }

            sw = sw || Window_Base._faceWidth;
            sh = sh || Window_Base._faceHeight;

            sw = Math.min(sw, pw);
            sh = Math.min(sh, ph);

            const sx = fi % 4 * pw + (pw - sw) / 2;
            const sy = Math.floor(fi / 4) * ph + (ph - sh) / 2;

            dx = Math.floor(dx + Math.max(sw - pw, 0) / 2) - 2;
            dy = Math.floor(dy + Math.max(sh - ph, 0) / 2) - 8;
            this._faceContents.bitmap.blt(bitmap, sx, sy, sw, sh, dx, dy);
        };

        $.Holders.battleDrawFace = Window_BattleStatus.prototype.drawFace;
        Window_BattleStatus.prototype.drawFace = function(name, index, x, y, w, h) {
            const actor = StateOverlay.findActor(name);
            const [prepend, append, replace] = StateOverlay.findOverlays(actor);

            for (let i = 0; i < prepend.length; i++) {
                const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, prepend[i]);
                $.Holders.battleDrawFace.call(this, prepend[i]["name"], index, x + dxf, y + dyf, wf || w, hf || h);
            }
            if (replace.length > 0) {
                const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, replace[replace.length - 1]);
                $.Holders.battleDrawFace.call(this, replace[replace.length - 1]["name"], index, x, y, w, h);

                if (replace[replace.length - 1]["mode"] === "combine") {
                    this.customDrawFace(name, index, wf || w, hf || h, x + dxf, y + dyf);
                }
            } else {
                $.Holders.battleDrawFace.call(this, name, index, x, y, w, h);
            }
            for (let i = 0; i < append.length; i++) {
                const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, append[i]);
                $.Holders.battleDrawFace.call(this, append[i]["name"], index, x + dxf, y + dyf, wf || w, hf || h);
            }
        };
    }

    if (Imported.Galv_BustMenu) {
        Window_MenuStatus.prototype.customDrawFace = function(n, fi, sw, sh, dx, dy) {
            const bn = n + "_" + (fi + 1);
            const bitmap = ImageManager.loadPicture(bn);

            if (bitmap.width <= 0) {
                return setTimeout(this.customDrawFace.bind(this, n, fi, sw, sh, dx, dy), 50);
            }

            let ox = 0;
            let oy = 0;
            if (Galv.BM.offsets[bn]) {
                ox = Galv.BM.offsets[bn][0] || 0;
                oy = Galv.BM.offsets[bn][1] || 0;
            }

            sw = sw || this.bustWidth();
            sh = sh || Galv.BM.bustHeight;

            const sx = bitmap.width / 2 - sw / 2 - ox;
            const sy = oy;

            dx = dx - 1;
            dy = dy + Galv.BM.bust;
            this.contents.unlimitedBlt(bitmap, sx, sy, sw, sh, dx, dy);
        };

        $.Holders.bustDrawFace = Window_MenuStatus.prototype.drawFace;
        Window_MenuStatus.prototype.drawFace = function (name, index, x, y, w, h) {
            const actor = StateOverlay.findActor(name);
            const [prepend, append, replace] = StateOverlay.findOverlays(actor);

            for (let i = 0; i < prepend.length; i++) {
                const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, prepend[i]);
                $.Holders.bustDrawFace.call(this, prepend[i]["name"], index, x + dxp, y + dyp, wp || w, hp || h);
            }
            if (replace.length > 0) {
                const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, replace[replace.length - 1]);
                $.Holders.bustDrawFace.call(this, replace[replace.length - 1]["name"], index, x, y, w, h);

                if (replace[replace.length - 1]["mode"] === "combine") {
                    this.customDrawFace(name, index, wp, hp, x + dxp, y + dyp);
                }
            } else {
                $.Holders.bustDrawFace.call(this, name, index, x, y, w, h);
            }
            for (let i = 0; i < append.length; i++) {
                const [dxf, dyf, dxp, dyp, wf, hf, wp, hp] = StateOverlay.unpackParameters(actor, append[i]);
                $.Holders.bustDrawFace.call(this, append[i]["name"], index, x + dxp, y + dyp, wp || w, hp || h);
            }
        };
    }

})(StateOverlay);