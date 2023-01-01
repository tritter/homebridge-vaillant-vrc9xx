module.exports = async (api) => {
    const { PLATFORM_NAME } = await import('./settings.mjs')
    const { VaillantVRC9xxPlatform } = await import('./homekit/VaillantVRC9xxPlatform.mjs')
    api.registerPlatform(PLATFORM_NAME, VaillantVRC9xxPlatform)
}
