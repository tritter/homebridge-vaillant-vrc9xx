import VRC700Accessory from './VRC700Accessory.mjs'

let Characteristic, Service

class VRC700HeaterRegulator extends VRC700Accessory {
    constructor(log, platform, accessory, config, desc) {
        Characteristic = platform.Characteristic
        Service = platform.Service

        super(log, platform, accessory, config, desc.name)

        //State
        this.CurrentHeatingCoolingState = undefined
        this.CurrentTemperature = undefined

        this.TargetDayTemperature = undefined
        this.TargetNightTemperature = undefined
        this.TargetHeatingCoolingState = undefined

        this.setTargetDayTemperatureCallback = desc.target_temp.update_callback
        this.setTargetNightTemperatureCallback = desc.target_reduced_temp.update_callback
        this.setHeatingModeCallback = desc.target_status.update_callback

        platform.registerObserver(desc.serial, desc.current_temp.path, this.updateCurrentTemperature.bind(this))
        platform.registerObserver(
            desc.serial,
            desc.current_status.path,
            this.updateCurrentHeatingCoolingState.bind(this)
        )

        platform.registerObserver(desc.serial, desc.target_temp.path, this.updateTargetDayTemperature.bind(this))
        platform.registerObserver(
            desc.serial,
            desc.target_reduced_temp.path,
            this.updateTargetNightTemperature.bind(this)
        )
        platform.registerObserver(desc.serial, desc.target_status.path, this.updateTargetHeatingCoolingState.bind(this))
    }

    // --------- CURRENT STATE
    getCurrentHeatingCoolingState() {
        switch (this.CurrentHeatingCoolingState) {
            case 'STANDBY':
                return Characteristic.CurrentHeatingCoolingState.OFF
            case 'HEATING':
                return Characteristic.CurrentHeatingCoolingState.HEAT
            default:
                return Characteristic.CurrentHeatingCoolingState.COOL
        }
    }

    updateCurrentHeatingCoolingState(value) {
        this.log(`Updating Current State from ${this.CurrentHeatingCoolingState} to ${value.current}`)

        this.CurrentHeatingCoolingState = value.current

        let newValue
        switch (this.CurrentHeatingCoolingState) {
            case 'STANDBY':
                newValue = Characteristic.CurrentHeatingCoolingState.OFF
                break
            case 'HEATING':
                newValue = Characteristic.CurrentHeatingCoolingState.HEAT
                break
            default:
                newValue = Characteristic.CurrentHeatingCoolingState.COOL
        }

        this.accessoryService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(newValue)
    }

    // --------- TARGET STATE
    vrc700ToHomeKitTargetState(vrc700state) {
        switch (this.TargetHeatingCoolingState) {
            case 'OFF':
                return Characteristic.TargetHeatingCoolingState.OFF
            case 'DAY':
                return Characteristic.TargetHeatingCoolingState.HEAT
            case 'AUTO':
                return Characteristic.TargetHeatingCoolingState.AUTO
            case 'NIGHT':
                return Characteristic.TargetHeatingCoolingState.COOL
        }
    }

    hkToVRC700TargetState(hkState) {
        switch (hkState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                return 'OFF'
            case Characteristic.TargetHeatingCoolingState.HEAT:
                return 'DAY'
            case Characteristic.TargetHeatingCoolingState.AUTO:
                return 'AUTO'
            case Characteristic.TargetHeatingCoolingState.COOL:
                return 'NIGHT'
        }
    }

    getTargetHeatingCoolingState() {
        let hkState = this.vrc700ToHomeKitTargetState(this.TargetHeatingCoolingState)
        return hkState
    }

    updateTargetHeatingCoolingState(value) {
        this.log(`Updating Target State from ${this.TargetHeatingCoolingState} to ${value.current}`)
        this.TargetHeatingCoolingState = value.current

        let hkState = this.vrc700ToHomeKitTargetState(this.TargetHeatingCoolingState)

        this.accessoryService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(hkState)

        this.updateTargetTemperature()
    }

    setTargetHeatingCoolingState(value) {
        let vrc700State = this.hkToVRC700TargetState(value)

        if (this.TargetHeatingCoolingState !== vrc700State) {
            this.log(`Setting Target State from ${this.TargetHeatingCoolingState} to ${vrc700State}`)

            this.TargetHeatingCoolingState = vrc700State
            this.setHeatingModeCallback(this.TargetHeatingCoolingState)

            this.updateTargetTemperature()
        }
    }

    // --------- CURRENT TEMPERATURE
    getCurrentTemperature() {
        this.log('Getting Current Temperature')
        return this.CurrentTemperature;
    }

    updateCurrentTemperature(value) {
        this.log(`Updating Current Temperature from ${this.CurrentTemperature} to ${value.current}`)
        this.CurrentTemperature = value.current

        this.accessoryService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.CurrentTemperature)
    }

    // --------- TARGET TEMPERATURE
    getTargetTemperature() {
        this.log('Getting Target Temperature')

        let targetTemp = this.TargetDayTemperature

        if (this.TargetHeatingCoolingState === 'NIGHT') {
            targetTemp = this.TargetNightTemperature
        }

        return targetTemp
    }

    updateTargetTemperature() {
        let targetTemp = this.TargetDayTemperature
        if (this.TargetHeatingCoolingState === 'NIGHT') {
            targetTemp = this.TargetNightTemperature
        }

        this.log('Target Temperature is now:', targetTemp)

        this.accessoryService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp)
    }

    setTargetTemperature(value) {
        if (this.TargetHeatingCoolingState === 'NIGHT') {
            return this.setTargetNightTemperature(value)
        }

        return this.setTargetDayTemperature(value)
    }

    // --------- TARGET DAY TEMPERATURE
    updateTargetDayTemperature(value) {
        this.log(`Updating Target Day Temperature from ${this.TargetDayTemperature} to ${value.current}`)
        this.TargetDayTemperature = value.current

        this.accessoryService
            .getCharacteristic(Characteristic.TargetDayTemperature)
            .updateValue(this.TargetDayTemperature)

        this.updateTargetTemperature()
    }

    getTargetDayTemperature() {
        this.log('Getting Target Day Temperature')

        let value = this.TargetDayTemperature
        if (this.TemperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
            value = cToF(value)
        }

        return value
    }

    setTargetDayTemperature(value) {
        this.log('Setting Target Day Temperature to: ', value)

        if (this.TemperatureDisplayUnits === Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
            value = fToC(value)
        }

        this.setTargetDayTemperatureCallback(value)
        this.TargetDayTemperature = value
    }

    // --------- TARGET NIGHT TEMPERATURE
    updateTargetNightTemperature(value) {
        this.log(`Updating Target Night Temperature from ${this.TargetNightTemperature} to ${value.current}`)
        this.TargetNightTemperature = value.current

        this.accessoryService
            .getCharacteristic(Characteristic.TargetNightTemperature)
            .updateValue(this.TargetNightTemperature)

        this.updateTargetTemperature()
    }

    getTargetNightTemperature() {
        this.log('Getting Target Night Temperature')

        let value = this.TargetNightTemperature
        if (this.TemperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
            value = cToF(value)
        }
        return value
    }

    setTargetNightTemperature(value) {
        this.log('Setting Target Night Temperature to: ', value)

        if (this.TemperatureDisplayUnits === Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
            value = fToC(value)
        }

        this.setTargetNightTemperatureCallback(value)
        this.TargetNightTemperature = value
    }

    getTemperatureDisplayUnits() {
        this.log('Getting Temperature Display Units')
        const json = {
            units: 0,
        }
        if (json.units == 0) {
            this.TemperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS
            this.log('Temperature Display Units is ℃')
        } else if (json.units == 1) {
            this.TemperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.FAHRENHEIT
            this.log('Temperature Display Units is ℉')
        }
        return this.TemperatureDisplayUnits
    }

    setTemperatureDisplayUnits(value) {
        this.log(`Setting Temperature Display Units from ${this.TemperatureDisplayUnits} to ${value}`)
        this.TemperatureDisplayUnits = value
    }

    getName() {
        this.log('getName :', this.name)
        return this.name
    }

    createAccessoryService() {
        const regulatorService = this.accessory.getService(this.udid) 
        || this.accessory.addService(Service.Thermostat, this.name, this.udid)
        regulatorService
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .onGet(this.getCurrentHeatingCoolingState.bind(this))

        regulatorService
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .onGet(this.getTargetHeatingCoolingState.bind(this))
            .onSet(this.setTargetHeatingCoolingState.bind(this))

        regulatorService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this))

        regulatorService
            .getCharacteristic(Characteristic.TargetTemperature)
            .onGet(this.getTargetTemperature.bind(this))
            .onSet(this.setTargetTemperature.bind(this))

        regulatorService
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .onGet(this.getTemperatureDisplayUnits.bind(this))
            .onSet(this.setTemperatureDisplayUnits.bind(this))

        regulatorService.getCharacteristic(Characteristic.Name).onGet(this.getName.bind(this))

        regulatorService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
                validValues: [0, 1, 2, 3],
            })

        regulatorService.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                maxValue: 100,
                minValue: 0,
                minStep: 0.1,
            })

        regulatorService.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: 5,
                maxValue: 30,
                minStep: 0.5,
            })

        regulatorService
            .getCharacteristic(Characteristic.TargetNightTemperature)
            .onGet(this.getTargetNightTemperature.bind(this))
            .onSet(this.setTargetNightTemperature.bind(this))

        regulatorService.getCharacteristic(Characteristic.TargetNightTemperature).setProps({
            maxValue: 30,
            minValue: 5,
            minStep: 0.5,
        })

        regulatorService
            .getCharacteristic(Characteristic.TargetDayTemperature)
            .onGet(this.getTargetDayTemperature.bind(this))
            .onSet(this.setTargetDayTemperature.bind(this))

        regulatorService.getCharacteristic(Characteristic.TargetDayTemperature).setProps({
            maxValue: 30,
            minValue: 5,
            minStep: 0.5,
        })

        this.accessoryService = regulatorService

        return regulatorService
    }
}

function cToF(value) {
    return Number(((9 * value) / 5 + 32).toFixed(0))
}

function fToC(value) {
    return Number(((5 * (value - 32)) / 9).toFixed(2))
}

export default VRC700HeaterRegulator
