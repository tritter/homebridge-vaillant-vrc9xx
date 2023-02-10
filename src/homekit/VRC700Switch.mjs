import VRC700Accessory from './VRC700Accessory.mjs'

let Characteristic, Service

class VRC700Switch extends VRC700Accessory {
    constructor(log, platform, accessory, config, desc) {
        Characteristic = platform.Characteristic
        Service = platform.Service

        super(log, platform, accessory, config, desc.name)

        this.currentValue = false

        this._services = this.createServices()

        this.getOnCallback = desc.get_callback
        this.setOnCallback = desc.set_callback

        platform.registerObserver(desc.serial, desc.path, this.updateCurrentValue.bind(this))
    }

    updateCurrentValue(value) {
        this.currentValue = this.getOnCallback(value)

        this.accessoryService.getCharacteristic(Characteristic.On)
            .updateValue(this.currentValue)
    }

    getOnValue() {
        this.log(`Getting ${this.name} switch value ${this.currentValue}`)
        return this.currentValue
    }

    setOnValue(value) {
        this.log(`Setting ${this.name} switch to ${value}`)
        this.setOnCallback(value)
        this.currentValue = value
    }

    createAccessoryService() {
        const service = this.accessory.getService(this.udid) || this.accessory.addService(Service.Switch, this.name, this.udid)
        service
            .setCharacteristic(Characteristic.Name, this.name)

        service
            .getCharacteristic(Characteristic.On)
                .onGet(this.getOnValue.bind(this))
                .onSet(this.setOnValue.bind(this))

        this.accessoryService = service
        return service
    }
}

export default VRC700Switch
