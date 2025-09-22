// gamepad.js

const isNear = (value, target, threshold = 0.1) => {
    return Math.abs(value - target) < threshold;
};

class CustomGamepad {
    constructor(id, axesCount, buttonsCount, matchFn, axisMap, povMap) {
        this.id = id;
        this.axesCount = axesCount;
        this.buttonsCount = buttonsCount;
        this.matchFn = matchFn;
        this.axisMap = axisMap || [];
        this.povMap = povMap || {};
    }

    matches(gamepad) {
        return this.matchFn(gamepad);
    }

    getAxis(gamepad) {
        return this.axisMap.map(axis => {
            return gamepad.axes[axis];
        });
    }

    getPOV(gamepad) {
        const pov = gamepad.axes[this.povMap.axis];

        const threshold = 0.1; // Define a threshold for POV detection

        return {
            'POV+Y': isNear(pov, this.povMap['POV+Y'], threshold),
            'POV-Y': isNear(pov, this.povMap['POV-Y'], threshold),
            'POV+X': isNear(pov, this.povMap['POV+X'], threshold),
            'POV-X': isNear(pov, this.povMap['POV-X'], threshold)
        };
    }
}

class GamepadManager {
    constructor() {
        this.customGamepads = [];
        this.connectedGamepads = new Map(); // key: index, value: {customType, gamepad, listeners}
        window.addEventListener('gamepadconnected', (e) => this._onConnect(e));
        window.addEventListener('gamepaddisconnected', (e) => this._onDisconnect(e));
        this._poll();
    }

    registerCustomGamepad(customGamepad) {
        this.customGamepads.push(customGamepad);
    }

    _identifyCustomGamepad(gamepad) {
        return this.customGamepads.find(type => type.matches(gamepad));
    }

    _onConnect(event) {
        const gamepad = event.gamepad;
        const customType = this._identifyCustomGamepad(gamepad);
        if (!customType) return; // Ignore unknown gamepads

        this.connectedGamepads.set(gamepad.index, {
            customType,
            gamepad,
            listeners: []
        });
    }

    _onDisconnect(event) {
        this.connectedGamepads.delete(event.gamepad.index);
    }

    subscribe(gamepadIndex, callback) {
        const entry = this.connectedGamepads.get(gamepadIndex);
        if (entry) {
            entry.listeners.push(callback);
        }
    }

    unsubscribe(gamepadIndex, callback) {
        const entry = this.connectedGamepads.get(gamepadIndex);
        if (entry) {
            entry.listeners = entry.listeners.filter(cb => cb !== callback);
        }
    }

    getConnectedGamepads() {
        return Array.from(this.connectedGamepads.values()).map(e => ({
            index: e.gamepad.index,
            id: e.customType.id,
            gamepad: e.gamepad
        }));
    }

    _poll() {
        // Poll gamepad state and notify listeners
        const pollGamepads = () => {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const [index, entry] of this.connectedGamepads.entries()) {
                const gp = gamepads[index];
                if (!gp) continue;
                for (const cb of entry.listeners) {
                    cb(gp);
                }
            }
            requestAnimationFrame(pollGamepads);
        };
        pollGamepads();
    }
}

// Define Logitech Extreme 3D Pro
const LogitechGExtreme3DPro = new CustomGamepad(
    'LogitechGExtreme3DPro',
    4,
    12,
    (gamepad) => {
        // Match by id string and axes/buttons count
        return (
            /Logitech.*Extreme 3D/i.test(gamepad.id) &&
            gamepad.axes.length === 10 &&
            gamepad.buttons.length === 12
        );
    },
    [
        0,
        1,
        5,
        6
    ],
    {
        axis: 9,
        'POV+Y': -1,
        'POV-Y': 0.14,
        'POV+X': -0.43,
        'POV-X': 0.71,
    }
);

export { GamepadManager, CustomGamepad, LogitechGExtreme3DPro };