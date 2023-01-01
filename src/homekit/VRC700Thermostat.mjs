import _ from 'lodash'

import VRC700Switch from './VRC700Switch.mjs'
import VRC700TemperatureSensor from './VRC700TemperatureSensor.mjs'
import VRC700ValveRegulator from './VRC700ValveRegulator.mjs'
import VRC700HeaterRegulator from './VRC700HeaterRegulator.mjs'
import VRC700HotWaterRegulator from './VRC700HotWaterRegulator.mjs'

class VRC700Thermostat {
    constructor(log, platform, accessory, config) {
        //Homebridge Config.
        this.log = log
        this.platform = platform
        this.accessory = accessory
        this.config = config

        this.sensors = config.sensors
        this.regulators = config.regulators
        this.dhw_regulators = config.dhw_regulators
        this.rbr_regulators = config.rbr_regulators
        this.switches = config.switches

        // state
        this._accessories = this.createAccessories()
    }

    getAccessories() {
        return this._accessories
    }

    createAccessories() {
        const accessories = [...this.createRegulators(), ...this.createSensors(), ...this.createSwitches()]
        accessories.forEach(access => {
            access.createServices()
        })
        return accessories
    }

    createSwitches() {
        let accessories = []
        this.switches.forEach(desc => {
            let accessory = new VRC700Switch(this.log, this.platform, this.accessory, this.config, desc)
            accessories.push(accessory)
        })

        return accessories
    }

    createSensors() {
        let accessories = []
        this.sensors.forEach(desc => {
            let accessory = new VRC700TemperatureSensor(this.log, this.platform, this.accessory, this.config, desc)
            accessories.push(accessory)
        })

        return accessories
    }

    createRegulators() {
        let accessories = []
        this.regulators.forEach(desc => {
            let regulator = new VRC700HeaterRegulator(this.log, this.platform, this.accessory, this.config, desc)
            accessories.push(regulator)
        })

        this.dhw_regulators.forEach(desc => {
            let regulator = new VRC700HotWaterRegulator(this.log, this.platform, this.accessory, this.config, desc)
            accessories.push(regulator)
        })

        this.rbr_regulators.forEach(desc => {
            let regulator = new VRC700ValveRegulator(this.log, this.platform, this.accessory, this.config, desc)
            accessories.push(regulator)
        })

        return accessories
    }
}

export default VRC700Thermostat
