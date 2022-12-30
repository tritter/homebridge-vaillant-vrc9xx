const generateUDID = (accessory, suffix) => {
    const uuid = accessory.UUID;
    return uuid.slice(0, suffix.length) + suffix;
}
import packageFile from '../../package.json'
let Accessory, Characteristic, Service
export default class VRC700Accessory {
    constructor(log, platform, accessory, config, name) {
        Accessory = platform.Accessory
        Characteristic = platform.Characteristic
        Service = platform.Service

        this.name = name || config.name || 'VRC700'
        this.udid = generateUDID(accessory, this.name)
        this.manufacturer = 'Vaillant'
        this.model = config.gateway
        this.firmware = config.firmware || 'UNKNOWN'
        this.serial = config.serial
        this.version = packageFile.version
        this.accessory = accessory

        this.log = (...args) => log(this.name, '>', ...args)
    }

    getAccessoryInformationService() {
        return this.accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.serial)
            .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)
            .setCharacteristic(Characteristic.HardwareRevision, this.version)
    }

    getBridgingStateService() {
        const udid = generateUDID(this.accessory, 'bridging');
        const service = this.accessory.getService(udid)
        || this.accessory.addService(Service.BridgingState, this.name, udid)
            .setCharacteristic(Characteristic.Reachable, true)
            .setCharacteristic(Characteristic.LinkQuality, 4)
            .setCharacteristic(Characteristic.AccessoryIdentifier, this.name)
            .setCharacteristic(Characteristic.Category, Accessory.Categories.SWITCH)
        return service
    }

    createServices() {
        var services = [this.getAccessoryInformationService(), this.getBridgingStateService()]
        var accessoryService = this.createAccessoryService()

        if (Array.isArray(accessoryService)) {
            accessoryService.forEach(serv => {
                services.push(serv)
            })
        } else {
            services.push(accessoryService)
        }

        return services
    }
}
