'use strict'

import _ from 'lodash'
import util from 'util'

import VaillantVRC9xxPlatformAccessory from './VaillantVRC9xxPlatformAccessory.mjs'
import VRC9xxAPI from '../api/VaillantAPIClient.mjs'
import VRC9xxAPIPoller, { VAILLANT_POLLER_EVENTS } from '../api/VaillantAPIPoller.mjs'
import { buildFacilityDescriptor } from './HomeKitDescriptor.mjs'
import { PLATFORM_NAME, PLUGIN_NAME } from '../settings.mjs'

const DEFAULT_CONFIG = {
    platform: 'VaillantVRC9xx',
    api: {
        polling: 300,
        user: {},
        debug: false,
        rooms: {
            disabled: false,
            veto_duration: 180,
        },
    },
}

export class VaillantVRC9xxPlatform {

    constructor(log, config, api) {
        this.Characteristic = api.hap.Characteristic
        this.Service = api.hap.Service
        this.Accessory = api.hap.Accessory

        log(`${PLATFORM_NAME} Platform loaded`)

        if (!config) {
            log.warn(`Ignoring ${PLATFORM_NAME} Platform setup because it is not configured`)
            this.disabled = true
            return
        }

        this.accessories = []
        this.config = this.mergeDefault(config)
        this.api = api
        this.log = log

        // create API client & poller
        this.VaillantAPI = new VRC9xxAPI(
            {
                smartphoneId: this.config.api.user.device,
                username: this.config.api.user.name,
                password: this.config.api.user.password,
            },
            log,
            { active: this.config.api.debug, path: this.api.user.storagePath() }
        )

        this.Poller = new VRC9xxAPIPoller(this.VaillantAPI, this.config, log)
        this.Poller.on(VAILLANT_POLLER_EVENTS.FACILITIES, this.facilitiesEvent.bind(this))
        this.Poller.on(VAILLANT_POLLER_EVENTS.FACILITIES_DONE, this.facilitiesDone.bind(this))

        defineCustomCharateristics(this.api.hap.Characteristic)

        this.api.on('accessoryRestored', this.configureAccessory.bind(this))
        this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this))
    }

    mergeDefault(config) {
        let newConfig = _.merge(DEFAULT_CONFIG, config)

        // check some default rules
        if (newConfig.api.polling < 30) newConfig.api.polling = 30

        return newConfig
    }

    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }

    async didFinishLaunching() {
        this.log('Finished launching')
        this.log('Start polling for data')
        await this.Poller.start()
    }

    facilitiesEvent(descriptor) {
        try {
            const facility = buildFacilityDescriptor(descriptor, this.VaillantAPI)

            const name = facility.name
            const serial = facility.serialNumber

            const uuid = this.api.hap.uuid.generate(serial)
            const accessory = this.accessories.find(a => a.UUID === uuid);

            const config_data = {
                name,
                serial,
                firmware: facility.firmwareVersion,
                gateway: facility.gateway,
                uuid,
                sensors: facility.sensors,
                regulators: facility.regulators,
                dhw_regulators: facility.dhw_regulators,
                rbr_regulators: facility.rbr_regulators,
                switches: facility.switches,
                contacts: facility.contacts
            }
            const platformAccessory = accessory || new this.api.platformAccessory(name, uuid);
            platformAccessory.context.config = config_data;
            new VaillantVRC9xxPlatformAccessory(this.log, this, platformAccessory);
            if (accessory) {
                this.log(`Restoring facility ${name} - ${serial} - ${uuid}`)
                this.api.updatePlatformAccessories([platformAccessory]);
              } else {
                this.log(`New facility ${name} - ${serial} - ${uuid}`)
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
              }
        } catch (error) {
            this.log(error)
            throw error
        }
    }

    facilitiesDone() {
        this.log(`End of initialization`)
    }

    registerObserver(serial, path, observer) {
        return this.Poller.subscribe(serial, path, observer)
    }
}

function defineCustomCharateristics(Characteristic) {
    Characteristic.TargetNightTemperature = function() {
        Characteristic.call(this, 'Target Night Temperature', '2DB4D12B-B2DD-42EA-A469-A23051F478D7')
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: Characteristic.Units.CELSIUS,
            maxValue: 30,
            minValue: 5,
            minStep: 0.5,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY],
        })
        this.value = this.getDefaultValue()
    }

    util.inherits(Characteristic.TargetNightTemperature, Characteristic)
    Characteristic.TargetNightTemperature.UUID = '2DB4D12B-B2DD-42EA-A469-A23051F478D7'

    Characteristic.TargetDayTemperature = function() {
        Characteristic.call(this, 'Target Day Temperature', 'E0C2907C-0011-4392-87B7-10622C654D5C')
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: Characteristic.Units.CELSIUS,
            maxValue: 30,
            minValue: 5,
            minStep: 0.5,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY],
        })
        this.value = this.getDefaultValue()
    }

    util.inherits(Characteristic.TargetDayTemperature, Characteristic)
    Characteristic.TargetDayTemperature.UUID = 'E0C2907C-0011-4392-87B7-10622C654D5C'
}
