const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PURPOSE = {
  en: {
    NSLocationWhenInUseUsageDescription: 'Location is used to warn you about road cameras during a trip.',
    NSLocationAlwaysAndWhenInUseUsageDescription: 'Allow location access all the time so camera warnings continue when the screen is off.',
    NSLocationAlwaysUsageDescription: 'Allow CamAlert to access your location all the time so camera warnings continue when the screen is off.',
    NSMotionUsageDescription: 'Allow CamAlert to detect your current motion activity.',
  },
  ru: {
    NSLocationWhenInUseUsageDescription: 'Местоположение нужно, чтобы предупреждать о дорожных камерах во время поездки.',
    NSLocationAlwaysAndWhenInUseUsageDescription: 'Разрешите геолокацию всегда, чтобы получать предупреждения о камерах при погашенном экране.',
    NSLocationAlwaysUsageDescription: 'Разрешите CamAlert доступ к геолокации всегда, чтобы предупреждения о камерах продолжались при погашенном экране.',
    NSMotionUsageDescription: 'Разрешите CamAlert определять текущий тип движения.',
  },
  uk: {
    NSLocationWhenInUseUsageDescription: 'Місцезнаходження потрібне, щоб попереджати про дорожні камери під час поїздки.',
    NSLocationAlwaysAndWhenInUseUsageDescription: 'Дозвольте геолокацію завжди, щоб отримувати попередження про камери, коли екран вимкнено.',
    NSLocationAlwaysUsageDescription: 'Дозвольте CamAlert доступ до геолокації завжди, щоб попередження про камери продовжувались, коли екран вимкнено.',
    NSMotionUsageDescription: 'Дозвольте CamAlert визначати поточний тип руху.',
  },
  pl: {
    NSLocationWhenInUseUsageDescription: 'Lokalizacja jest potrzebna, aby ostrzegać o fotoradarach podczas podróży.',
    NSLocationAlwaysAndWhenInUseUsageDescription: 'Zezwól na lokalizację przez cały czas, aby ostrzeżenia o kamerach działały przy wyłączonym ekranie.',
    NSLocationAlwaysUsageDescription: 'Zezwól CamAlert na dostęp do lokalizacji przez cały czas, aby ostrzeżenia o kamerach działały przy wyłączonym ekranie.',
    NSMotionUsageDescription: 'Pozwól CamAlert wykrywać bieżący rodzaj ruchu.',
  },
};

function stringsFile(copy) {
  return Object.entries(copy).map(([key, value]) => `"${key}" = "${value}";`).join('\n') + '\n';
}

function attachLocalizations(project) {
  const objects = project.hash.project.objects;
  const variants = objects.PBXVariantGroup || {};
  if (Object.values(variants).some(group => group && group.name === 'InfoPlist.strings')) return;
  const groupKey = Object.keys(objects.PBXGroup).find(key => {
    const group = objects.PBXGroup[key];
    return group && Array.isArray(group.children) && group.children.some(child => child.comment === 'Info.plist');
  });
  if (!groupKey) throw new Error('Cannot attach location purpose localizations');
  const variantKey = project.pbxCreateVariantGroup('InfoPlist.strings');
  project.addToPbxGroup(variantKey, groupKey);
  const buildFile = { uuid: project.generateUuid(), fileRef: variantKey, basename: 'InfoPlist.strings' };
  project.addToPbxBuildFileSection(buildFile);
  project.addToPbxResourcesBuildPhase(buildFile);
  for (const language of Object.keys(PURPOSE)) {
    project.addResourceFile(`CamAlert/${language}.lproj/InfoPlist.strings`, { variantGroup: true }, variantKey);
    project.addKnownRegion(language);
  }
}

function withLocationPurpose(config) {
  config = withDangerousMod(config, ['ios', mod => {
    const appDir = path.join(mod.modRequest.platformProjectRoot, 'CamAlert');
    for (const [language, copy] of Object.entries(PURPOSE)) {
      const dir = path.join(appDir, `${language}.lproj`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'InfoPlist.strings'), stringsFile(copy));
    }
    return mod;
  }]);
  return withXcodeProject(config, mod => {
    attachLocalizations(mod.modResults);
    return mod;
  });
}

module.exports = withLocationPurpose;
module.exports.attachLocalizations = attachLocalizations;
module.exports.PURPOSE = PURPOSE;
