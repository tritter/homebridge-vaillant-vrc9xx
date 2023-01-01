import VRC700Accessory from './VRC700Accessory.mjs'

let Characteristic, Service

const BATTERY_LEVEL_NORMAL = 0
const BATTERY_LEVEL_LOW = 1

class VRC700ValveRegulator extends VRC700Accessory {
    constructor(log, platform, accessory, config, desc) {
        Characteristic = platform.Characteristic
        Service = platform.Service

        super(log, platform, accessory, config, desc.name)

        this.veto_duration = platform.config.api.rooms.veto_duration

        //State
        this.CurrentHeatingCoolingState = undefined
        this.CurrentTemperature = undefined
        this.TargetTemperature = undefined
        this.StatusLowBattery = undefined

        this.setTargetTemperatureCallback = desc.target_temp.update_callback
        this.setRoomQuickVeto = desc.target_temp.veto_callback
        this.setHeatingModeCallback = desc.target_status.update_callback

        platform.registerObserver(desc.serial, desc.current_temp.path, this.updateCurrentTemperature.bind(this))
        platform.registerObserver(desc.serial, desc.status_low_battery.path, this.updateStatusLowBattery.bind(this))

        platform.registerObserver(
            desc.serial,
            desc.current_status.path,
            this.updateCurrentHeatingCoolingState.bind(this)
        )

        platform.registerObserver(desc.serial, desc.target_temp.path, this.updateTargetTemperature.bind(this))
        platform.registerObserver(desc.serial, desc.target_status.path, this.updateTargetHeatingCoolingState.bind(this))
    }

    // --------- CURRENT STATE
    getCurrentHeatingCoolingState() {
        if (this.CurrentHeatingCoolingState === 'OFF') {
            return Characteristic.CurrentHeatingCoolingState.OFF
        }

        if (this.CurrentTemperature > this.TargetTemperature) {
            return Characteristic.CurrentHeatingCoolingState.OFF
        }

        return Characteristic.CurrentHeatingCoolingState.HEAT
    }

    updateCurrentHeatingCoolingState(value) {
        this.log(`Updating Current State from ${this.CurrentHeatingCoolingState} to ${value.current}`)
        this.CurrentHeatingCoolingState = value.current

        this.getCurrentHeatingCoolingState((_, value) =>
            this.accessoryService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
        )
    }

    // --------- TARGET STATE
    vrc700ToHomeKitTargetState(vrc700state) {
        switch (vrc700state) {
            case 'OFF':
                return Characteristic.TargetHeatingCoolingState.OFF
            case 'MANUAL':
                return Characteristic.TargetHeatingCoolingState.HEAT
            case 'AUTO':
                return Characteristic.TargetHeatingCoolingState.AUTO
        }
    }

    hkToVRC700TargetState(hkState) {
        switch (hkState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                return 'OFF'
            case Characteristic.TargetHeatingCoolingState.HEAT:
                return 'MANUAL'
            case Characteristic.TargetHeatingCoolingState.AUTO:
                return 'AUTO'
            case Characteristic.TargetHeatingCoolingState.COOL:
                return 'OFF'
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
    }

    setTargetHeatingCoolingState(value) {
        let vrc700State = this.hkToVRC700TargetState(value)

        if (this.TargetHeatingCoolingState !== vrc700State) {
            this.log(`Setting Target State from ${this.TargetHeatingCoolingState} to ${vrc700State}`)

            this.TargetHeatingCoolingState = vrc700State
            this.setHeatingModeCallback(this.TargetHeatingCoolingState)
        }
    }

    // --------- CURRENT TEMPERATURE
    getCurrentTemperature() {
        this.log('Getting Current Temperature')
        return this.CurrentTemperature
    }

    updateCurrentTemperature(value) {
        this.log(`Updating Current Temperature from ${this.CurrentTemperature} to ${value.current}`)
        this.CurrentTemperature = value.current

        this.accessoryService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.CurrentTemperature)
    }

    // --------- Low Battery
    getStatusLowBattery() {
        this.log('Getting Current Battery Status')
        return this.StatusLowBattery
    }

    updateStatusLowBattery(value) {
        this.log(`Updating Current Battery Status from ${this.StatusLowBattery} to ${value.current}`)
        this.StatusLowBattery = value.current ? BATTERY_LEVEL_LOW : BATTERY_LEVEL_NORMAL

        this.accessoryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(this.StatusLowBattery)
    }

    // --------- TARGET TEMPERATURE
    updateTargetTemperature(value) {
        this.log(`Updating Target Room Temperature from ${this.TargetTemperature} to ${value.current}`)
        this.TargetTemperature = value.current

        this.accessoryService.getCharacteristic(Characteristic.TargetTemperature).updateValue(this.TargetTemperature)
    }

    getTargetTemperature() {
        this.log('Getting Target Room Temperature')
        return this.TargetTemperature
    }

    setTargetTemperature(value) {
        if (this.TemperatureDisplayUnits === Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
            value = cToF(value)
        }

        /*
         *  if mode == AUTO -> use a Quick Veto
         *  else (OFF or MANUAL) -> set target temperature
         */
        if (this.TargetHeatingCoolingState === 'AUTO') {
            this.setRoomQuickVeto(value, this.veto_duration)
        } else {
            this.setTargetTemperatureCallback(value)
            this.TargetTemperature = value
        }

        this.log('Setting Target Room Temperature to: ', value)
    }

    getTemperatureDisplayUnits() {
        this.log('Getting Temperature Display Units')
        const json = {
            units: 0,
        }
        if (json.units === 0) {
            this.TemperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS
            this.log('Temperature Display Units is ℃')
        } else if (json.units === 1) {
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
        const regulator = this.accessory.getService(this.udid) 
        || this.accessory.addService(Service.Thermostat, this.name, this.udid)
        regulator
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .onGet(this.getCurrentHeatingCoolingState.bind(this))

        regulator
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .onGet(this.getTargetHeatingCoolingState.bind(this))
            .onSet(this.setTargetHeatingCoolingState.bind(this))

        regulator.getCharacteristic(Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this))

        regulator.getCharacteristic(Characteristic.StatusLowBattery)
            .onGet(this.getStatusLowBattery.bind(this))

        regulator
            .getCharacteristic(Characteristic.TargetTemperature)
            .onGet(this.getTargetTemperature.bind(this))
            .onSet(this.setTargetTemperature.bind(this))

        regulator
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .onGet(this.getTemperatureDisplayUnits.bind(this))
            .onSet(this.setTemperatureDisplayUnits.bind(this))

        regulator.getCharacteristic(Characteristic.Name)
            .onGet(this.getName.bind(this))

        regulator.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .setProps({
                minValue: 0,
                maxValue: 1,
                validValues: [0, 1],
            })

        regulator.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
                validValues: [0, 1, 3],
            })

        regulator.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: 0.1,
            })

        regulator.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: 5,
                maxValue: 30,
                minStep: 0.5,
            })

        this.accessoryService = regulator

        return regulator
    }
}

export default VRC700ValveRegulator
