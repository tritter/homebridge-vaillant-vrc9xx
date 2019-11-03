import _ from 'lodash'
import { API_COMMANDS } from './VaillantAPICommands.mjs'
import { HTTPClient } from './HttpClient.mjs'

const BASE_URL = 'https://smart.vaillant.com/mobile/api/v4/'

class VRC9xxAPI {
    constructor(data, log) {
        this.log = log ? log : console.log
        this.httpClient = new HTTPClient(BASE_URL, this.log)

        this.config = {
            authData: data,
        }

        this.state = {
            authenticated: false,
            pendingCommands: [],
            timer: undefined,
        }
    }

    async query(command) {
        if (!command.unauthenticated && !this.state.authenticated) {
            await this.logIn(true)
        }

        try {
            const resp = await this.httpClient.execute(command)
            return resp.data ? resp.data : resp
        } catch (e) {
            return this.handleError(e, command)
        }
    }

    handleError(e, command) {
        if (e.response) {
            if (e.response.status === 401) {
                this.state.authenticated = false
            }

            this.log({
                status: e.response.status,
                statusText: e.response.statusText,
                headers: e.response.headers,
                //data: JSON.stringify(resp.data, null, '  '),
            })
        }

        throw e
    }

    handleResponse(resp) {
        this.log({
            status: resp.status,
            statusText: resp.statusText,
            //headers: resp.headers,
            //data: JSON.stringify(resp.data, null, '  '),
        })

        return resp.data
    }

    async logIn(force = false) {
        if (force) {
            this.httpClient = new HTTPClient(BASE_URL, this.log)
            delete this.state.authData
        }

        if (!this.state.authData) {
            const response = await this.query(API_COMMANDS.LOGIN(this.config.authData))

            this.state.authData = {
                smartphoneId: this.config.authData.smartphoneId,
                username: this.config.authData.username,
                authToken: response.body.authToken,
            }
        }

        await this.query(API_COMMANDS.AUTHORIZE(this.state.authData))

        this.state.authenticated = true
    }

    async getFacilities() {
        this.log('Get all facilities ...')
        const resp = await this.query(API_COMMANDS.GET_ALL_FACILITIES)
        return resp.body.facilitiesList
    }

    async getFullSystem(facilitySerial) {
        return await this.query(API_COMMANDS.GET_FULL_SYSTEM_FOR_FACILITY(facilitySerial))
    }

    async getStatus(facilitySerial) {
        return await this.query(API_COMMANDS.GET_STATUS_FOR_FACILITY(facilitySerial))
    }

    async getEmfLiveReport(facilitySerial) {
        return await this.query(API_COMMANDS.GET_LIVE_REPORT_FOR_FACILITY(facilitySerial))
    }

    async getGateway(facilitySerial) {
        return await this.query(API_COMMANDS.GET_GATEWAY_FOR_FACILITY(facilitySerial), null)
    }

    async getFullState(facilitySerial) {
        const response = await Promise.all([
            this.getFullSystem(facilitySerial),
            this.getEmfLiveReport(facilitySerial),
            this.getStatus(facilitySerial),
            this.getGateway(facilitySerial),
        ])

        const bodies = response.map(it => {
            return it.body
        })

        const metas = response.map(it => {
            return it.meta
        })

        // build main object
        const info = _.zipObject(['system', 'measures', 'status', 'gateway'], bodies)

        // index zones by id
        info.system.zones = _.zipObject(info.system.zones.map(zone => zone._id), info.system.zones)

        // index dwh by id
        info.system.dhw = _.zipObject(info.system.dhw.map(dhw => dhw._id), info.system.dhw)

        // isolate temperature measures
        let devices = info.measures.devices
        Object.keys(info.system.dhw).forEach(key => {
            let measures = []
            let reports = devices.find(item => item._id === key)
            if (reports) {
                measures = reports.reports.filter(item => item.measurement_category === 'TEMPERATURE')
            }

            info.system.dhw[key].configuration = _.zipObject(measures.map(item => item._id), measures)
        })

        // look for stale data
        var pending = false
        var recent = 0
        var now = new Date().getTime() - 60000 * new Date().getTimezoneOffset()

        metas.forEach(meta => {
            if (meta.resourceState) {
                meta.resourceState.forEach(item => {
                    if (item.state !== 'SYNCED') {
                        pending = true
                    }

                    var time = item.timestamp
                    if (time.toString().length < 13) {
                        time *= 1000
                    }

                    recent = Math.max(recent, time)
                })
            }
        })

        info.meta = { pending, timestamp: recent, age: now - recent, old: now - recent > 10 }

        return info
    }

    enqueueCommand(command) {
        const index = _.findIndex(this.state.pendingCommands, item => {
            return item.url === command.url
        })
        if (index >= 0) {
            this.log('Similar command pending ... replacing')
            this.state.pendingCommands[index] = command
            return
        }

        this.state.pendingCommands.push(command)

        if (!this.timer) {
            this.timer = setTimeout(this.processQueue.bind(this), 500)
        }
    }

    async processQueue() {
        var command = this.state.pendingCommands.shift()
        while (command) {
            this.log('Processing command')
            await this.query(command)
            var command = this.state.pendingCommands.shift()
        }

        this.timer = null
    }

    async setTargetTemperature(facilitySerial, zone, temperature) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration/setpoint_temperature`

        const data = {
            setpoint_temperature: temperature,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setTargetDHWTemperature(facilitySerial, dhw, temperature) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/dhw/${dhw}/hotwater/configuration/temperature_setpoint`

        const data = {
            temperature_setpoint: temperature,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setTargetReducedTemperature(facilitySerial, zone, temperature) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration/setback_temperature`

        const data = {
            setback_temperature: temperature,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setHeatingMode(facilitySerial, zone, mode) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration/mode`

        const data = {
            mode,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    async setDHWOperationMode(facilitySerial, dhw, mode) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/dhw/${dhw}/hotwater/configuration/operation_mode`

        const data = {
            operation_mode: mode,
        }

        this.enqueueCommand({
            url,
            data,
            method: 'put',
        })
    }

    // *******************************************************************
    async getOverview(facilitySerial) {
        const url = `/facilities/${facilitySerial}/hvacstate/v1/overview`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getZoneConfig(facilitySerial, zone = 'Control_ZO1') {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getZones(facilitySerial) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones`
        const zones = await this.query(url, 'get', null)
        return zones.data.body
    }

    async getDWHTimeprogram(facilitySerial, dhwIdentifier = 'Control_DHW') {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/dhw/${dhwIdentifier}/hotwater/timeprogram`

        var timeprog = await this.query(url, 'get', null)
        var json = JSON.stringify(timeprog.data.body, null, 4)
        this.log(json)
    }

    async getZoneHeatingConfig(facilitySerial, zone = 'Control_ZO1') {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/configuration`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getEmfReportForDevice() {
        const deviceId = 'Control_SYS_MultiMatic'
        const reportId = 'WaterPressureSensor'

        const url = `/facilities/${config.facilitySerial}/livereport/v1/devices/${deviceId}/reports/${reportId}`
        const info = await this.query(url, 'get', null)

        var json = JSON.stringify(info.data.body, null, 4)
        this.log(json)
    }

    async getZoneTimeprogram(facilitySerial, zone = 'Control_ZO1') {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/zones/${zone}/heating/timeprogram`

        var timeprog = await this.query(url, 'get', null)
        var json = JSON.stringify(timeprog.data.body, null, 4)
        this.log(json)
    }

    async setZoneTimeprogram(zone = 'Control_ZO1') {
        const timeschedule = await require('./ts.json')
        const url = `/facilities/${config.facilitySerial}/systemcontrol/v1/zones/${zone}/heating/timeprogram`

        var timeprog = await this.query(url, 'put', timeschedule)
        this.log(timeprog.status)
    }

    async getParameters(facilitySerial) {
        const url = `/facilities/${facilitySerial}/systemcontrol/v1/parameters`
        const info = await this.query(url, 'get', null)
        return info.data.body
    }

    async getEvents(facilitySerial) {
        const url = `/facilities/${facilitySerial}/events/v1`
        const info = await this.query(url, 'get', null)

        return info.data.body
    }
}

export default VRC9xxAPI
