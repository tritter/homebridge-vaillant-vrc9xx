import VRC700Thermostat from './VRC700Thermostat'

export default class VaillantVRC9xxPlatformAccessory {

    constructor(log, platform, accessory) {
        const config = accessory.context.config;
        this.thermostat = new VRC700Thermostat(log, platform, accessory, config);
    }
}