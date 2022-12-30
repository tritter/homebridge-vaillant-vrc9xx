import VRC700Accessory from './VRC700Accessory.mjs'

let Characteristic, Service

class VRC700Switch extends VRC700Accessory {
    constructor(log, platform, accessory, config, desc) {
        Characteristic = platform.Characteristic
        Service = platform.Service

        super(log, platform, accessory, config, desc.name)

        this.currentValue = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED

        this._services = this.createServices()

        platform.registerObserver(desc.serial, desc.path, this.updateCurrentValue.bind(this))
    }

    getCurrentValue(callback) {
        return callback(null, this.currentValue)
    }

    updateCurrentValue(value) {
        this.currentValue = value.current
            ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
            : Characteristic.ContactSensorState.CONTACT_DETECTED

        this.accessoryService.getCharacteristic(Characteristic.ContactSensorState)
            .updateValue(this.currentValue)
    }

    createAccessoryService() {
        const service = this.accessory.getService(this.udid)
      || this.accessory.addService(Service.Switch, this.name, this.udid)
        service
            .setCharacteristic(Characteristic.Name, this.name)
            .getCharacteristic(Characteristic.ContactSensorState)
            .onGet(this.getCurrentValue.bind(this))
        this.accessoryService = service
        return service
    }
}

export default VRC700Switch
