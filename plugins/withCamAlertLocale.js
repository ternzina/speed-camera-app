const { withMainApplication, withMainActivity, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
module.exports = function withCamAlertLocale(config) {
  config = withMainApplication(config, mod => {
    const source = mod.modResults.contents;
    if (!source.includes('add(CamAlertLocalePackage())')) {
      const anchor = 'PackageList(this).packages.apply {';
      if (!source.includes(anchor)) throw new Error('Cannot register CamAlertLocalePackage');
      mod.modResults.contents = source.replace(anchor, `${anchor}\n              add(CamAlertLocalePackage())`);
    }
    return mod;
  });
  config = withMainActivity(config, mod => {
    const source = mod.modResults.contents;
    if (!source.includes('// CamAlert app language')) {
      const anchor = 'super.onCreate(null)';
      if (!source.includes(anchor)) throw new Error('Cannot restore CamAlert app language');
      mod.modResults.contents = source.replace(anchor, `// CamAlert app language\n    getSharedPreferences("camalert_locale", 0).getString("language", null)?.let {\n      androidx.appcompat.app.AppCompatDelegate.setApplicationLocales(androidx.core.os.LocaleListCompat.forLanguageTags(it))\n    }\n    ${anchor}`);
    }
    return mod;
  });
  config = withAndroidManifest(config, mod => {
    const activity = mod.modResults.manifest.application[0].activity.find(a => a.$['android:name'] === '.MainActivity');
    if (!activity) throw new Error('MainActivity missing');
    const values = new Set((activity.$['android:configChanges'] || '').split('|').filter(Boolean));
    values.add('locale'); values.add('layoutDirection');
    activity.$['android:configChanges'] = [...values].join('|');
    return mod;
  });
  return withDangerousMod(config, ['android', mod => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/com/camera21wek');
    fs.mkdirSync(target, {recursive:true});
    fs.copyFileSync(path.join(__dirname, 'native/CamAlertLocalePackage.kt'), path.join(target, 'CamAlertLocalePackage.kt'));
    return mod;
  }]);
};
