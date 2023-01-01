import VRC700Accessory from './VRC700Accessory.mjs'

let Service, Characteristic

class VRC700TemperatureSensor extends VRC700Accessory {
    constructor(log, platform, accessory, config, desc) {
        Service = platform.Service
        Characteristic = platform.Characteristic

        super(log, platform, accessory, config, desc.name)

        this.displayName = desc.name

        this.currentTemperature = undefined
        this.serial = desc.id

        this.platform = platform

        this.platform.registerObserver(desc.serial, desc.path, this.updateCurrentTemperature.bind(this))
    }

    getCurrentTemperature() {
        return this.currentTemperature
    }

    updateCurrentTemperature(value) {
        this.log(`Updating Current Temperature from ${this.currentTemperature} to ${value.current}`)
        this.currentTemperature = value.current

        this.accessoryService.getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this.currentTemperature)
    }

    createAccessoryService() {
        const service = this.accessory.getService(this.udid) || this.accessory.addService(Service.TemperatureSensor, this.name, this.udid)

        service
            .setCharacteristic(Characteristic.Name, this.name)
        
        service
            .getCharacteristic(Characteristic.CurrentTemperature)
                .onGet(this.getCurrentTemperature.bind(this))

        this.accessoryService = service
        return service
    }
}

export default VRC700TemperatureSensor
