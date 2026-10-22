// Bundled offline country notes for the laws page. No network fetch.
// Statuses follow the 2026 research grouping already recorded. This is not a new grading.
// Three statuses only: known_limits, checked_functions, needs_review.

export const LEGAL_STATUSES = ["known_limits", "checked_functions", "needs_review"];

export const STATUS_LABELS = {
  ru: {
    known_limits: "известные ограничения",
    checked_functions: "проверено для конкретных функций",
    needs_review: "требуется уточнение",
  },
  uk: {
    known_limits: "відомі обмеження",
    checked_functions: "перевірено для конкретних функцій",
    needs_review: "потрібне уточнення",
  },
  en: {
    known_limits: "known limits",
    checked_functions: "checked for specific features",
    needs_review: "needs clarification",
  },
  pl: {
    known_limits: "znane ograniczenia",
    checked_functions: "sprawdzone dla konkretnych funkcji",
    needs_review: "wymaga doprecyzowania",
  },
};

export const DISPUTED_ISO = ["AE","AL","AM","AO","AR","AT","AU","AZ","BA","BD","BG","BN","BO","BR","BW","BY","CA","CI","CL","CN","CO","CR","CU","CY","CZ","DK","DZ","EC","EE","FI","GE","GR","GT","HK","HR","ID","IE","IL","IN","IQ","IR","IS","JO","JP","KE","KG","KH","KW","KZ","LB","LI","LK","LT","LV","MA","MC","MD","ME","MK","MM","MN","MT","MU","MX","MY","NA","NP","PA","PE","PG","PH","PK","PL","PT","PY","QA","RS","RW","SA","SG","SI","SK","SV","SY","TH","TJ","TM","TN","TR","TT","TZ","UG","US","UY","UZ","VE","VN","ZA"];

export const NOTICES = [
  {
    "iso": "HK",
    "names": {
      "ru": "Гонконг",
      "uk": "Гонконг",
      "en": "Hong Kong",
      "pl": "Hongkong"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.info.gov.hk/gia/general/200803/05/P200803050203.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "UA",
    "names": {
      "ru": "Украина",
      "uk": "Україна",
      "en": "Ukraine",
      "pl": "Ukraina"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверен показ стационарных камер официальным приложением. Мобильная проверка не включена. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірено показ стаціонарних камер офіційним застосунком. Мобільна перевірка не включена. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check covered the display of fixed cameras by the official app. Mobile checks are not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzono pokaz kamer stałych w oficjalnej aplikacji. Kontrola mobilna nie jest włączona. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://mvs.gov.ua/news/mvs-onovilo-zastosunki-ta-servisi-dlya-oplati-strafiv-za-porusennya-pdr",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates"
    ]
  },
  {
    "iso": "PL",
    "names": {
      "ru": "Польша",
      "uk": "Польща",
      "en": "Poland",
      "pl": "Polska"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://api.sejm.gov.pl/eli/acts/DU/2024/1251/text.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "FR",
    "names": {
      "ru": "Франция",
      "uk": "Франція",
      "en": "France",
      "pl": "Francja"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "Статья R. 413-15 Code de la route ограничивает устройства, цель которых — предупредить или сообщить место средств фиксации. Открытый текст не делит страну на части.",
      "uk": "Стаття R. 413-15 Code de la route обмежує пристрої, мета яких — попередити або повідомити місце засобів фіксації. Відкритий текст не ділить країну на частини.",
      "en": "Article R. 413-15 of the Highway Code restricts devices meant to warn about or report the location of enforcement equipment. The open text does not split the country.",
      "pl": "Artykuł R. 413-15 kodeksu drogowego ogranicza urządzenia, których celem jest ostrzec lub podać położenie sprzętu kontroli. Otwarty tekst nie dzieli kraju na części."
    },
    "sourceUrl": "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000025111528",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "ES",
    "names": {
      "ru": "Испания",
      "uk": "Іспанія",
      "en": "Spain",
      "pl": "Hiszpania"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Статья 13.6 исключает механизмы, которые сообщают позицию контроля. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Стаття 13.6 виключає механізми, які повідомляють позицію контролю. Перевірені GPS-попередження, точні координати і мобільна перевірка. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "Article 13.6 leaves out mechanisms that report the position of a control. The check covered GPS warnings, exact coordinates, and mobile checks. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Artykuł 13.6 wyłącza mechanizmy, które podają pozycję kontroli. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "DE",
    "names": {
      "ru": "Германия",
      "uk": "Німеччина",
      "en": "Germany",
      "pl": "Niemcy"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "§ 23 абз. 1c StVO запрещает водителю пользоваться функцией, которая показывает меры контроля. Открытый текст не выделяет часть страны.",
      "uk": "§ 23 абз. 1c StVO забороняє водієві користуватися функцією, яка показує заходи контролю. Відкритий текст не виділяє частину країни.",
      "en": "StVO § 23(1c) forbids a driver to use a function that shows traffic controls. The open text does not set aside part of the country.",
      "pl": "§ 23 ust. 1c StVO zabrania kierowcy używać funkcji, która pokazuje kontrole ruchu. Otwarty tekst nie wyłącza części kraju."
    },
    "sourceUrl": "https://www.gesetze-im-internet.de/stvo_2013/__23.html",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "GB",
    "names": {
      "ru": "Великобритания",
      "uk": "Велика Британія",
      "en": "United Kingdom",
      "pl": "Wielka Brytania"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Ответ полиции подтверждает предупреждение о местах камер, если устройство не держат в руке. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Відповідь поліції підтверджує попередження про місця камер, якщо пристрій не тримають у руці. Перевірені GPS-попередження, точні координати і мобільна перевірка. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The police reply confirms warnings about camera locations if the device is not held in the hand. The check covered GPS warnings, exact coordinates, and mobile checks. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Odpowiedź policji potwierdza ostrzeżenie o miejscach kamer, jeśli urządzenia nie trzyma się w ręce. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://www.askthe.police.uk/faq/?id=11a6b302-4475-ec11-8943-0022480702b6",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "IE",
    "names": {
      "ru": "Ирландия",
      "uk": "Ірландія",
      "en": "Ireland",
      "pl": "Irlandia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.irishstatutebook.ie/eli/1991/si/50/made/en/print",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PT",
    "names": {
      "ru": "Португалия",
      "uk": "Португалія",
      "en": "Portugal",
      "pl": "Portugalia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=349&tabela=leis&ficha=1&pagina=1&so_miolo=",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "IT",
    "names": {
      "ru": "Италия",
      "uk": "Італія",
      "en": "Italy",
      "pl": "Włochy"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Разъяснение полиции покрывает заранее записанные предупреждения о стационарных постах. Проверены GPS-предупреждение и точные координаты. Мобильная проверка не включена. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Роз'яснення поліції покриває заздалегідь записані попередження про стаціонарні пости. Перевірені GPS-попередження і точні координати. Мобільна перевірка не включена. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The police explanation covers pre-recorded warnings about fixed posts. The check covered GPS warnings and exact coordinates. Mobile checks are not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Wyjaśnienie policji obejmuje wcześniej zapisane ostrzeżenia o stałych posterunkach. Sprawdzono ostrzeżenie GPS i dokładne współrzędne. Kontrola mobilna nie jest włączona. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://poliziamoderna.poliziadistato.it/articolo/56c49128228b9918137097",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates"
    ]
  },
  {
    "iso": "AT",
    "names": {
      "ru": "Австрия",
      "uk": "Австрія",
      "en": "Austria",
      "pl": "Austria"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.ris.bka.gv.at/eli/bgbl/1967/267/P98a/NOR40227852",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CH",
    "names": {
      "ru": "Швейцария",
      "uk": "Швейцарія",
      "en": "Switzerland",
      "pl": "Szwajcaria"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "Статья 98a SVG запрещает публично предупреждать об официальном контроле и использовать для этого обычное устройство. Открытый текст не выделяет часть страны.",
      "uk": "Стаття 98a SVG забороняє публічно попереджати про офіційний контроль і використовувати для цього звичайний пристрій. Відкритий текст не виділяє частину країни.",
      "en": "Article 98a SVG prohibits public warnings about official traffic controls and using an ordinary device to give one. The open text does not set aside part of the country.",
      "pl": "Artykuł 98a SVG zakazuje publicznie ostrzegać o oficjalnej kontroli i używać do tego zwykłego urządzenia. Otwarty tekst nie wyłącza części kraju."
    },
    "sourceUrl": "https://www.fedlex.admin.ch/eli/cc/1959/679_705_685/de",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "BE",
    "names": {
      "ru": "Бельгия",
      "uk": "Бельгія",
      "en": "Belgium",
      "pl": "Belgia"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Ответ правительства от 10.10.2013 подтверждает указание камер. Проверены GPS-предупреждение, точные координаты и заранее записанная мобильная точка. Детектор не входит. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Відповідь уряду від 10.10.2013 підтверджує вказівку камер. Перевірені GPS-попередження, точні координати і заздалегідь записана мобільна точка. Детектор не входить. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The government reply of 10 October 2013 confirms pointing out cameras. The check covered GPS warnings, exact coordinates, and a pre-recorded mobile point. A detector is not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Odpowiedź rządu z 10.10.2013 potwierdza wskazywanie kamer. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i wcześniej zapisany punkt mobilny. Detektor nie wchodzi. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://www.ejustice.just.fgov.be/eli/loi/1968/03/16/1968031601/justel",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "NL",
    "names": {
      "ru": "Нидерланды",
      "uk": "Нідерланди",
      "en": "Netherlands",
      "pl": "Holandia"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка говорит о предупреждении мест контроля и об узком запрете радарных приёмников. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірка говорить про попередження місць контролю і про вузьку заборону радарних приймачів. Перевірені GPS-попередження, точні координати і мобільна перевірка. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check speaks about warnings of control locations and a narrow ban on radar receivers. It covered GPS warnings, exact coordinates, and mobile checks. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzenie mówi o ostrzeganiu o miejscach kontroli i o wąskim zakazie odbiorników radarowych. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://wetten.overheid.nl/BWBR0025554/",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "LU",
    "names": {
      "ru": "Люксембург",
      "uk": "Люксембург",
      "en": "Luxembourg",
      "pl": "Luksemburg"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Ответ министров от 11.03.2026 назвал сигналы о контроле. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Детекторы по-прежнему запрещены. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Відповідь міністрів від 11.03.2026 назвала сигнали про контроль. Перевірені GPS-попередження, точні координати і мобільна перевірка. Детектори і далі заборонені. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The ministers' reply of 11 March 2026 named warnings about controls. The check covered GPS warnings, exact coordinates, and mobile checks. Detectors remain prohibited. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Odpowiedź ministrów z 11.03.2026 wymieniła sygnały o kontroli. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Detektory pozostają zabronione. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://legilux.public.lu/eli/etat/leg/code/route/20250809",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "DK",
    "names": {
      "ru": "Дания",
      "uk": "Данія",
      "en": "Denmark",
      "pl": "Dania"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.retsinformation.dk/eli/lta/1998/748",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SE",
    "names": {
      "ru": "Швеция",
      "uk": "Швеція",
      "en": "Sweden",
      "pl": "Szwecja"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверены точные координаты стационарных камер и публикация. Мобильная проверка не включена. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірені точні координати стаціонарних камер і публікація. Мобільна перевірка не включена. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check covered exact coordinates of fixed cameras and their publication. Mobile checks are not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzono dokładne współrzędne kamer stałych i publikację. Kontrola mobilna nie jest włączona. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198815-om-forbud-mot-vissa-radar-och_sfs-1988-15/",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates"
    ]
  },
  {
    "iso": "NO",
    "names": {
      "ru": "Норвегия",
      "uk": "Норвегія",
      "en": "Norway",
      "pl": "Norwegia"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Приложения описаны как находящиеся вне § 13a. Проект запрета законом не стал. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Застосунки описані як такі, що є поза § 13a. Проєкт заборони законом не став. Перевірені GPS-попередження, точні координати і мобільна перевірка. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "Apps are described as outside § 13a. A proposed ban had not become law. The check covered GPS warnings, exact coordinates, and mobile checks. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Aplikacje opisano jako pozostające poza § 13a. Projekt zakazu nie stał się ustawą. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://lovdata.no/dokument/NL/lov/1965-06-18-4/KAPITTEL_2",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "FI",
    "names": {
      "ru": "Финляндия",
      "uk": "Фінляндія",
      "en": "Finland",
      "pl": "Finlandia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.finlex.fi/files/extra/statute-book-of-finland-pdf/fin/1998/19980074.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "IS",
    "names": {
      "ru": "Исландия",
      "uk": "Ісландія",
      "en": "Iceland",
      "pl": "Islandia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.althingi.is/lagas/nuna/2019077.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CZ",
    "names": {
      "ru": "Чехия",
      "uk": "Чехія",
      "en": "Czech Republic",
      "pl": "Czechy"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.e-sbirka.cz/sb/2000/361",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SK",
    "names": {
      "ru": "Словакия",
      "uk": "Словаччина",
      "en": "Slovakia",
      "pl": "Słowacja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://static.slov-lex.sk/pdf/SK/ZZ/2009/8/ZZ_2009_8_20261001.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "HU",
    "names": {
      "ru": "Венгрия",
      "uk": "Угорщина",
      "en": "Hungary",
      "pl": "Węgry"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "KRESZ 3. § (3) исключает средства, заранее предупреждающие о проверке. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "KRESZ 3. § (3) виключає засоби, які заздалегідь попереджають про перевірку. Перевірені GPS-попередження, точні координати і мобільна перевірка. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "KRESZ 3. § (3) leaves out means that warn about a check in advance. The check covered GPS warnings, exact coordinates, and mobile checks. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "KRESZ 3. § (3) wyłącza środki, które z góry ostrzegają o kontroli. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://net.jogtar.hu/jogszabaly?docid=97500001.KPM",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "RO",
    "names": {
      "ru": "Румыния",
      "uk": "Румунія",
      "en": "Romania",
      "pl": "Rumunia"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Статья 44(5) описывает предупреждения и собственные средства обнаружения. Проверены GPS-предупреждение, точные координаты и мобильная проверка. Спидометр строка не подтвердила. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Стаття 44(5) описує попередження і власні засоби виявлення. Перевірені GPS-попередження, точні координати і мобільна перевірка. Спідометр рядок не підтвердив. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "Article 44(5) describes warnings and a driver's own detection means. The check covered GPS warnings, exact coordinates, and mobile checks. The row did not confirm a speedometer. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Artykuł 44(5) opisuje ostrzeżenia i własne środki wykrywania. Sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Wiersz nie potwierdził prędkościomierza. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://legislatie.just.ro/Public/DetaliiDocument/74028",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "BG",
    "names": {
      "ru": "Болгария",
      "uk": "Болгарія",
      "en": "Bulgaria",
      "pl": "Bułgaria"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://lex.bg/laws/ldoc/2134649345",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "HR",
    "names": {
      "ru": "Хорватия",
      "uk": "Хорватія",
      "en": "Croatia",
      "pl": "Chorwacja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://mup.gov.hr/promet-281589/21-je-li-dopusteno-u-vozilo-ugraditi-radar-detektor/281769",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SI",
    "names": {
      "ru": "Словения",
      "uk": "Словенія",
      "en": "Slovenia",
      "pl": "Słowenia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://pisrs.si/pregledPredpisa?id=ZAKO5793",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "RS",
    "names": {
      "ru": "Сербия",
      "uk": "Сербія",
      "en": "Serbia",
      "pl": "Serbia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.abs.gov.rs/static/uploads/17585_ZOBS_19-25.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "BA",
    "names": {
      "ru": "Босния и Герцеговина",
      "uk": "Боснія і Герцеговина",
      "en": "Bosnia and Herzegovina",
      "pl": "Bośnia i Hercegowina"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.parlament.ba/law/DownloadDocument?langTag=bs&lawDocumentId=1ec38890-c533-446f-868b-d629bbde3d22",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "ME",
    "names": {
      "ru": "Черногория",
      "uk": "Чорногорія",
      "en": "Montenegro",
      "pl": "Czarnogóra"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://wapi.gov.me/download/022a8ec6-b13e-44d2-8493-24e781bd94c3?version=1.0",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MK",
    "names": {
      "ru": "Северная Македония",
      "uk": "Північна Македонія",
      "en": "North Macedonia",
      "pl": "Macedonia Północna"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://rsbsp.org.mk/sites/default/files/zakon-za-bezbednost-na-soobrakajot-na-patistata-precisten.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AL",
    "names": {
      "ru": "Албания",
      "uk": "Албанія",
      "en": "Albania",
      "pl": "Albania"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://qeverisjavendore.gov.al/wp-content/uploads/2024/08/Ligj-nr.-8378-date-22.7.1998-Kodi-rrugor-i-Republikes-se-Shqiperise.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "GR",
    "names": {
      "ru": "Греция",
      "uk": "Греція",
      "en": "Greece",
      "pl": "Grecja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.yme.gov.gr/images/articleimages/odiki_kykloforia_kai_asfaleia/kodikas_odikis_kykloforias/n_5209_2025_a100_13-6-2025_NEOS_KOK_.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "LT",
    "names": {
      "ru": "Литва",
      "uk": "Литва",
      "en": "Lithuania",
      "pl": "Litwa"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://e-seimas.lrs.lt/rs/actualedition/TAIS.111999/UdguBRanIM/format/ISO_PDF/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "LV",
    "names": {
      "ru": "Латвия",
      "uk": "Латвія",
      "en": "Latvia",
      "pl": "Łotwa"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://likumi.lv/ta/id/45467",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "EE",
    "names": {
      "ru": "Эстония",
      "uk": "Естонія",
      "en": "Estonia",
      "pl": "Estonia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.riigiteataja.ee/akt/103062026013",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MD",
    "names": {
      "ru": "Молдова",
      "uk": "Молдова",
      "en": "Moldova",
      "pl": "Mołdawia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://e-lex.md/eli/md/cod/2008/218/ro@2026-09-13#crt_1__tit_II__chp_13__art_228",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CY",
    "names": {
      "ru": "Кипр",
      "uk": "Кіпр",
      "en": "Cyprus",
      "pl": "Cypr"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.cylaw.org/nomoi/enop/non-ind/2001_1_55/full.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MT",
    "names": {
      "ru": "Мальта",
      "uk": "Мальта",
      "en": "Malta",
      "pl": "Malta"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://legislation.mt/eli/cap/65/eng/pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "XK",
    "names": {
      "ru": "Косово",
      "uk": "Косово",
      "en": "Kosovo",
      "pl": "Kosowo"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Для этого кода в материалах проверки нет отдельной записи. Разрешение и запрет не записаны.",
      "uk": "Для цього коду в матеріалах перевірки немає окремого запису. Дозвіл і заборона не записані.",
      "en": "The research files have no separate entry for this code. Permission and a ban are not recorded.",
      "pl": "Materiały sprawdzenia nie mają osobnego wpisu dla tego kodu. Zezwolenie i zakaz nie są zapisane."
    },
    "sourceUrl": null,
    "checkedOn": null,
    "checkedFunctions": null
  },
  {
    "iso": "TR",
    "names": {
      "ru": "Турция",
      "uk": "Туреччина",
      "en": "Turkey",
      "pl": "Turcja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.resmigazete.gov.tr/eskiler/2026/02/20260227-0.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AD",
    "names": {
      "ru": "Андорра",
      "uk": "Андорра",
      "en": "Andorra",
      "pl": "Andora"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Статья 4.11 исключает механизмы предупреждения о позиции контроля. В этой рамке проверены GPS-предупреждение, точные координаты и мобильная проверка. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Стаття 4.11 виключає механізми попередження про позицію контролю. У цій рамці перевірені GPS-попередження, точні координати і мобільна перевірка. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "Article 4.11 leaves out mechanisms that warn about the position of a control. Within that limit, the check covered GPS warnings, exact coordinates, and mobile checks. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Artykuł 4.11 wyłącza mechanizmy ostrzegania o pozycji kontroli. W tej ramie sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://www.consellgeneral.ad/ca/arxiu/arxiu-de-lleis-i-textos-aprovats-en-legislatures-anteriors/viii-legislatura-2019-2023-1/lleis-aprovades/llei-12-2021-del-13-de-maig-del-codi-de-la-circulacio/at_download/PDF",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "LI",
    "names": {
      "ru": "Лихтенштейн",
      "uk": "Ліхтенштейн",
      "en": "Liechtenstein",
      "pl": "Liechtenstein"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.gesetze.li/konso/pdf/1978018000?version=",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MC",
    "names": {
      "ru": "Монако",
      "uk": "Монако",
      "en": "Monaco",
      "pl": "Monako"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://legimonaco.mc/code/code-route@2026.07.04",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SM",
    "names": {
      "ru": "Сан-Марино",
      "uk": "Сан-Марино",
      "en": "San Marino",
      "pl": "San Marino"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Для этого кода в материалах проверки нет отдельной записи. Разрешение и запрет не записаны.",
      "uk": "Для цього коду в матеріалах перевірки немає окремого запису. Дозвіл і заборона не записані.",
      "en": "The research files have no separate entry for this code. Permission and a ban are not recorded.",
      "pl": "Materiały sprawdzenia nie mają osobnego wpisu dla tego kodu. Zezwolenie i zakaz nie są zapisane."
    },
    "sourceUrl": null,
    "checkedOn": null,
    "checkedFunctions": null
  },
  {
    "iso": "VA",
    "names": {
      "ru": "Ватикан",
      "uk": "Ватикан",
      "en": "Vatican City",
      "pl": "Watykan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Для этого кода в материалах проверки нет отдельной записи. Разрешение и запрет не записаны.",
      "uk": "Для цього коду в матеріалах перевірки немає окремого запису. Дозвіл і заборона не записані.",
      "en": "The research files have no separate entry for this code. Permission and a ban are not recorded.",
      "pl": "Materiały sprawdzenia nie mają osobnego wpisu dla tego kodu. Zezwolenie i zakaz nie są zapisane."
    },
    "sourceUrl": null,
    "checkedOn": null,
    "checkedFunctions": null
  },
  {
    "iso": "US",
    "names": {
      "ru": "США",
      "uk": "США",
      "en": "USA",
      "pl": "USA"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://law.lis.virginia.gov/vacode/title46.2/chapter10/section46.2-1079/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CA",
    "names": {
      "ru": "Канада",
      "uk": "Канада",
      "en": "Canada",
      "pl": "Kanada"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.ontario.ca/laws/statute/90h08",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "RU",
    "names": {
      "ru": "Россия",
      "uk": "Росія",
      "en": "Russia",
      "pl": "Rosja"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверена опубликованная координата, включая передвижные средства из постановления № 754. В этой рамке проверены GPS-предупреждение, точные координаты и мобильная проверка. Живое сообщение пользователя не включено. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірена опублікована координата, включно з пересувними засобами з постанови № 754. У цій рамці перевірені GPS-попередження, точні координати і мобільна перевірка. Живе повідомлення користувача не включене. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check covered a published coordinate, including mobile units from Resolution No. 754. Within that limit it covered GPS warnings, exact coordinates, and mobile checks. A live user report is not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzono opublikowaną współrzędną, w tym środki przenośne z uchwały nr 754. W tej ramie sprawdzono ostrzeżenie GPS, dokładne współrzędne i kontrolę mobilną. Bieżące zgłoszenie użytkownika nie jest włączone. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "http://government.ru/docs/all/153613/",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates",
      "mobile_check"
    ]
  },
  {
    "iso": "BY",
    "names": {
      "ru": "Беларусь",
      "uk": "Білорусь",
      "en": "Belarus",
      "pl": "Białoruś"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.adu.by/images/2025/11/24/Ukaz-Prezidenta-RB-28-11-2005-551.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "GE",
    "names": {
      "ru": "Грузия",
      "uk": "Грузія",
      "en": "Georgia",
      "pl": "Gruzja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://matsne.gov.ge/ka/document/view/28216",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AM",
    "names": {
      "ru": "Армения",
      "uk": "Вірменія",
      "en": "Armenia",
      "pl": "Armenia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.arlis.am/hy/acts/20/latest",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AZ",
    "names": {
      "ru": "Азербайджан",
      "uk": "Азербайджан",
      "en": "Azerbaijan",
      "pl": "Azerbejdżan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://frameworks.e-qanun.az/0/c_c_24.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "BR",
    "names": {
      "ru": "Бразилия",
      "uk": "Бразилія",
      "en": "Brazil",
      "pl": "Brazylia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AU",
    "names": {
      "ru": "Австралия",
      "uk": "Австралія",
      "en": "Australia",
      "pl": "Australia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-2013-018",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "NZ",
    "names": {
      "ru": "Новая Зеландия",
      "uk": "Нова Зеландія",
      "en": "New Zealand",
      "pl": "Nowa Zelandia"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверены стационарные камеры и публикация координат. Мобильная проверка не включена. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірені стаціонарні камери і публікація координат. Мобільна перевірка не включена. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check covered fixed cameras and the publication of coordinates. Mobile checks are not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzono kamery stałe i publikację współrzędnych. Kontrola mobilna nie jest włączona. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://nzta.govt.nz/safety/driving-safely/safety-cameras/about-safety-cameras/fixed-safety-camera-locations",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates"
    ]
  },
  {
    "iso": "JP",
    "names": {
      "ru": "Япония",
      "uk": "Японія",
      "en": "Japan",
      "pl": "Japonia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.shugiin.go.jp/internet/itdb_shitsumon.nsf/html/shitsumon/b198201.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "ZA",
    "names": {
      "ru": "ЮАР",
      "uk": "ПАР",
      "en": "South Africa",
      "pl": "RPA"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.gov.za/sites/default/files/gcis_document/201409/32258589.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "KR",
    "names": {
      "ru": "Республика Корея",
      "uk": "Республіка Корея",
      "en": "South Korea",
      "pl": "Korea Południowa"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверены фиксированные камеры и точные координаты на закреплённом экране. Мобильная проверка не включена. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірені фіксовані камери і точні координати на закріпленому екрані. Мобільна перевірка не включена. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check covered fixed cameras and exact coordinates on a mounted screen. Mobile checks are not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzono kamery stałe i dokładne współrzędne na zamocowanym ekranie. Kontrola mobilna nie jest włączona. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://www.data.go.kr/data/15028200/standard.do",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates"
    ]
  },
  {
    "iso": "CL",
    "names": {
      "ru": "Чили",
      "uk": "Чилі",
      "en": "Chile",
      "pl": "Chile"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.bcn.cl/leychile/navegar?idNorma=1007469",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AR",
    "names": {
      "ru": "Аргентина",
      "uk": "Аргентина",
      "en": "Argentina",
      "pl": "Argentyna"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.argentina.gob.ar/normativa/nacional/norma-818/actualizacion",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TW",
    "names": {
      "ru": "Тайвань",
      "uk": "Тайвань",
      "en": "Taiwan",
      "pl": "Tajwan"
    },
    "status": "checked_functions",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверен открытый набор точек с координатами, направлением и лимитом. Мобильная проверка не включена. Проверены только названные функции. Это не вывод обо всём приложении.",
      "uk": "Перевірений відкритий набір точок із координатами, напрямком і лімітом. Мобільна перевірка не включена. Перевірені лише названі функції. Це не висновок про весь застосунок.",
      "en": "The check covered a public set of points with coordinates, direction, and a limit. Mobile checks are not included. Only the named features were checked. This is not a conclusion about the whole app.",
      "pl": "Sprawdzono otwarty zbiór punktów ze współrzędnymi, kierunkiem i limitem. Kontrola mobilna nie jest włączona. Sprawdzono tylko wymienione funkcje. To nie jest wniosek o całej aplikacji."
    },
    "sourceUrl": "https://data.gov.tw/dataset/7320",
    "checkedOn": "2026-10-21",
    "checkedFunctions": [
      "gps_warning",
      "exact_coordinates"
    ]
  },
  {
    "iso": "IR",
    "names": {
      "ru": "Иран",
      "uk": "Іран",
      "en": "Iran",
      "pl": "Iran"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://laws.tehran.ir/Law/MainLawView/146",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AE",
    "names": {
      "ru": "ОАЭ",
      "uk": "ОАЕ",
      "en": "United Arab Emirates",
      "pl": "ZEA"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://uaelegislation.gov.ae/ar/legislations/2598",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "OM",
    "names": {
      "ru": "Оман",
      "uk": "Оман",
      "en": "Oman",
      "pl": "Oman"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "Таблица штрафов Королевской полиции запрещает устройство, которое предупреждает о приборах контроля скорости. Номер статьи на странице не указан. Открытый текст не выделяет часть страны.",
      "uk": "Таблиця штрафів Королівської поліції забороняє пристрій, який попереджає про прилади контролю швидкості. Номер статті на сторінці не вказаний. Відкритий текст не виділяє частину країни.",
      "en": "The Royal Oman Police fine table prohibits a device that warns of speed-control equipment. The page does not give an article number. The open text does not set aside part of the country.",
      "pl": "Tabela mandatów Policji Królewskiej zakazuje urządzenia, które ostrzega o sprzęcie kontroli prędkości. Numer artykułu na stronie nie jest podany. Otwarty tekst nie wyłącza części kraju."
    },
    "sourceUrl": "https://www.rop.gov.om/mTraffic/TOPayment/ar/trafficfines.htm",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "UZ",
    "names": {
      "ru": "Узбекистан",
      "uk": "Узбекистан",
      "en": "Uzbekistan",
      "pl": "Uzbekistan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://lex.uz/docs/97664",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "IN",
    "names": {
      "ru": "Индия",
      "uk": "Індія",
      "en": "India",
      "pl": "Indie"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.indiacode.nic.in/bitstream/123456789/15390/1/the_motor_vehicles_act%2C_1988.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "ID",
    "names": {
      "ru": "Индонезия",
      "uk": "Індонезія",
      "en": "Indonesia",
      "pl": "Indonezja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://peraturan.bpk.go.id/Download/27961/UU%20Nomor%2022%20Tahun%202009.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CN",
    "names": {
      "ru": "Китай",
      "uk": "Китай",
      "en": "China",
      "pl": "Chiny"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.gov.cn/zhengce/2021-12/25/content_5712868.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "IQ",
    "names": {
      "ru": "Ирак",
      "uk": "Ірак",
      "en": "Iraq",
      "pl": "Irak"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.sjc.iq/view.79350/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SA",
    "names": {
      "ru": "Саудовская Аравия",
      "uk": "Саудівська Аравія",
      "en": "Saudi Arabia",
      "pl": "Arabia Saudyjska"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/85364e57-c01e-41ba-8def-a9a700f183e9/1",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "KZ",
    "names": {
      "ru": "Казахстан",
      "uk": "Казахстан",
      "en": "Kazakhstan",
      "pl": "Kazachstan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://old.adilet.zan.kz/rus/docs/K1400000235",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TM",
    "names": {
      "ru": "Туркменистан",
      "uk": "Туркменістан",
      "en": "Turkmenistan",
      "pl": "Turkmenistan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.turkmenistan.gov.tm/ru/post/20428/kodeks-turkmenistana%3Cbr%3Eob-administrativnykh-pravonarusheniyakh",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SG",
    "names": {
      "ru": "Сингапур",
      "uk": "Сінгапур",
      "en": "Singapore",
      "pl": "Singapur"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.lta.gov.sg/content/ltagov/en/newsroom/2025/12/media-replies/continuing-efforts-made-to-enhance-features.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "QA",
    "names": {
      "ru": "Катар",
      "uk": "Катар",
      "en": "Qatar",
      "pl": "Katar"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://encyclop.sjc.gov.qa/lawlib/Images/criminal/laws/19-2007/1.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "IL",
    "names": {
      "ru": "Израиль",
      "uk": "Ізраїль",
      "en": "Israel",
      "pl": "Izrael"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://oknesset.org/meetings/5/5/556081.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "KG",
    "names": {
      "ru": "Киргизия",
      "uk": "Киргизстан",
      "en": "Kyrgyzstan",
      "pl": "Kirgistan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://cbd.minjust.gov.kg/api/v1/GetEdition?editionId=60031&lang=ru",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MY",
    "names": {
      "ru": "Малайзия",
      "uk": "Малайзія",
      "en": "Malaysia",
      "pl": "Malezja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.jpj.gov.my/wp-content/uploads/2025/05/Act-333-English.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MN",
    "names": {
      "ru": "Монголия",
      "uk": "Монголія",
      "en": "Mongolia",
      "pl": "Mongolia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://legalinfo.mn/mn/detail?lawId=208663",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "KW",
    "names": {
      "ru": "Кувейт",
      "uk": "Кувейт",
      "en": "Kuwait",
      "pl": "Kuwejt"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.moi.gov.kw/GDT/trafficviolations",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TH",
    "names": {
      "ru": "Таиланд",
      "uk": "Таїланд",
      "en": "Thailand",
      "pl": "Tajlandia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.ratchakitcha.soc.go.th/DATA/PDF/2565/A/028/T_0005.PDF",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "JO",
    "names": {
      "ru": "Иордания",
      "uk": "Йорданія",
      "en": "Jordan",
      "pl": "Jordania"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://moi.gov.jo/ebv4.0/root_storage/ar/eb_list_page/%D9%82%D8%A7%D9%86%D9%88%D9%86_%D8%A7%D9%84%D8%B3%D9%8A%D8%B1-0.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "VN",
    "names": {
      "ru": "Вьетнам",
      "uk": "В'єтнам",
      "en": "Vietnam",
      "pl": "Wietnam"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-168-2024-nd-cp-quy-dinh-xu-phat-vi-pham-hanh-chinh-ve-trat-tu-atgt-duong-bo-119241231164556785.htm",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PH",
    "names": {
      "ru": "Филиппины",
      "uk": "Філіппіни",
      "en": "Philippines",
      "pl": "Filipiny"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://lawphil.net/statutes/repacts/ra2016/ra_10913_2016.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "NP",
    "names": {
      "ru": "Непал",
      "uk": "Непал",
      "en": "Nepal",
      "pl": "Nepal"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://traffic.nepalpolice.gov.np/notices/49/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "BH",
    "names": {
      "ru": "Бахрейн",
      "uk": "Бахрейн",
      "en": "Bahrain",
      "pl": "Bahrajn"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "Статья 47 пункт 16 закона о дорожном движении запрещает хранить в машине или использовать устройства, которые предупреждают о местах измерения скорости. Открытый текст не выделяет часть страны.",
      "uk": "Стаття 47 пункт 16 закону про дорожній рух забороняє зберігати в машині або використовувати пристрої, які попереджають про місця вимірювання швидкості. Відкритий текст не виділяє частину країни.",
      "en": "Article 47(16) of the traffic law prohibits keeping in a vehicle, or using, devices that warn about speed-measurement locations. The open text does not set aside part of the country.",
      "pl": "Artykuł 47 punkt 16 ustawy o ruchu drogowym zakazuje przechowywać w pojeździe lub używać urządzeń, które ostrzegają o miejscach pomiaru prędkości. Otwarty tekst nie wyłącza części kraju."
    },
    "sourceUrl": "https://www.traffic.gov.bh/new-traffic-law/new-traffic-law/newtrafficlaw",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "MM",
    "names": {
      "ru": "Мьянма",
      "uk": "М'янма",
      "en": "Myanmar",
      "pl": "Mjanma"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": null,
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SY",
    "names": {
      "ru": "Сирия",
      "uk": "Сирія",
      "en": "Syria",
      "pl": "Syria"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://alp-city.sy/File/DataBank/file/LMLaG7DVzcoACDfEbXZLvbJ2n55qt3T0Dn1L82yQ.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "LK",
    "names": {
      "ru": "Шри-Ланка",
      "uk": "Шрі-Ланка",
      "en": "Sri Lanka",
      "pl": "Sri Lanka"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://documents.gov.lk/api/content-file-proxy?file=%2Fact-content%2F10-2019_E_1784552885.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "KH",
    "names": {
      "ru": "Камбоджа",
      "uk": "Камбоджа",
      "en": "Cambodia",
      "pl": "Kambodża"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": null,
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "BN",
    "names": {
      "ru": "Бруней",
      "uk": "Бруней",
      "en": "Brunei",
      "pl": "Brunei"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.agc.gov.bn/AGC%20Images/LAWS/ACT_PDF/cap068.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "BD",
    "names": {
      "ru": "Бангладеш",
      "uk": "Бангладеш",
      "en": "Bangladesh",
      "pl": "Bangladesz"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://legislativediv.portal.gov.bd/sites/default/files/files/legislativediv.portal.gov.bd/page/c0e8021e_5e8f_4ede_9050_f2faf351c2ad/24.%20Road%20Transport%20Act%2C%202018.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "LB",
    "names": {
      "ru": "Ливан",
      "uk": "Ліван",
      "en": "Lebanon",
      "pl": "Liban"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://isf.gov.lb/laws/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PK",
    "names": {
      "ru": "Пакистан",
      "uk": "Пакистан",
      "en": "Pakistan",
      "pl": "Pakistan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://senate.gov.pk/uploads/documents/1782296129_320.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TJ",
    "names": {
      "ru": "Таджикистан",
      "uk": "Таджикистан",
      "en": "Tajikistan",
      "pl": "Tadżykistan"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://sud.tj/upload/iblock/156/5d70jzrvdy01t3kaw0t1z0mt67b3oikn.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CO",
    "names": {
      "ru": "Колумбия",
      "uk": "Колумбія",
      "en": "Colombia",
      "pl": "Kolumbia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "http://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002_pr003.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "EC",
    "names": {
      "ru": "Эквадор",
      "uk": "Еквадор",
      "en": "Ecuador",
      "pl": "Ekwador"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.gob.ec/sites/default/files/regulations/2019-12/REGLAMENTO_A_LA_LEY_DE_TRANSPORTE_TERRESTRE_TRANSITO_Y_SEGURIDAD_VIAL.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "UY",
    "names": {
      "ru": "Уругвай",
      "uk": "Уругвай",
      "en": "Uruguay",
      "pl": "Urugwaj"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.impo.com.uy/bases/leyes-originales/19061-2013/13",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PE",
    "names": {
      "ru": "Перу",
      "uk": "Перу",
      "en": "Peru",
      "pl": "Peru"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.sutran.gob.pe/wp-content/uploads/2020/08/Texto-%C3%9Anico-Ordenado-del-Reglamento-Nacional-de-Tr%C3%A1nsito-DS-N%C2%BA-016-2009-MTC.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "BO",
    "names": {
      "ru": "Боливия",
      "uk": "Болівія",
      "en": "Bolivia",
      "pl": "Boliwia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://web.mingobierno.gob.bo/wp-content/uploads/2025/09/LEY-3988-CODIGO-NAL-DE-TRANSITO-Y-SU-REGLAMENTO.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "VE",
    "names": {
      "ru": "Венесуэла",
      "uk": "Венесуела",
      "en": "Venezuela",
      "pl": "Wenezuela"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://tugacetaoficial.com/leyes/reglamento-de-la-ley-de-transito-terrestre-gaceta-5240-1998-texto/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PY",
    "names": {
      "ru": "Парагвай",
      "uk": "Парагвай",
      "en": "Paraguay",
      "pl": "Paragwaj"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.bacn.gov.py/leyes-paraguayas/10175/ley-n-6868-modifica-y-amplia-el-articulo-66-de-la-ley-n-50162014-nacional-de-transito-y-seguridad-vial",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MX",
    "names": {
      "ru": "Мексика",
      "uk": "Мексика",
      "en": "Mexico",
      "pl": "Meksyk"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://ecobici.cdmx.gob.mx/wp-content/uploads/2026/10/REGLAMENTO_DE_TRNSITO_DE_LA_CIUDAD_DE_MXICO_6.4.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SV",
    "names": {
      "ru": "Сальвадор",
      "uk": "Сальвадор",
      "en": "El Salvador",
      "pl": "Salwador"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.transparencia.gob.sv/descarga_archivo.php?id=NjExMjQ4&inst=611248",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CU",
    "names": {
      "ru": "Куба",
      "uk": "Куба",
      "en": "Cuba",
      "pl": "Kuba"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.gacetaoficial.gob.cu/sites/default/files/goc-2026-es10.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "GT",
    "names": {
      "ru": "Гватемала",
      "uk": "Гватемала",
      "en": "Guatemala",
      "pl": "Gwatemala"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://mingob.gob.gt/wp-content/uploads/2020/10/Ley-y-Reglamento-Transito.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PA",
    "names": {
      "ru": "Панама",
      "uk": "Панама",
      "en": "Panama",
      "pl": "Panama"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://monitoreo.antai.gob.pa/api/submissions/412819/files/94265/download",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CR",
    "names": {
      "ru": "Коста-Рика",
      "uk": "Коста-Рика",
      "en": "Costa Rica",
      "pl": "Kostaryka"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?nValor1=1&nValor2=73504&nValor3=0&param1=NRTC&strTipM=TC",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TT",
    "names": {
      "ru": "Тринидад и Тобаго",
      "uk": "Тринідад і Тобаго",
      "en": "Trinidad and Tobago",
      "pl": "Trynidad i Tobago"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.mowt.gov.tt/MOWT/media/General/Documents/UTurn%20System/Fixed-Penalty-and-DPS-listing-Final.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "EG",
    "names": {
      "ru": "Египет",
      "uk": "Єгипет",
      "en": "Egypt",
      "pl": "Egipt"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "Article (75) bis на странице МВД запрещает устройства, которые обнаруживают места радаров скорости или предупреждают о них. Открытый текст не выделяет часть страны.",
      "uk": "Article (75) bis на сторінці МВС забороняє пристрої, які виявляють місця радарів швидкості або попереджають про них. Відкритий текст не виділяє частину країни.",
      "en": "Article (75) bis on the Interior Ministry page prohibits devices that detect speed-radar locations or warn about them. The open text does not set aside part of the country.",
      "pl": "Article (75) bis na stronie MSW zakazuje urządzeń, które wykrywają miejsca radarów prędkości lub ostrzegają o nich. Otwarty tekst nie wyłącza części kraju."
    },
    "sourceUrl": "https://traffic.moi.gov.eg/English/OurServices/InfoServices/TrafficGuide/Pages/traffic-violations-and-penalties.aspx",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "DZ",
    "names": {
      "ru": "Алжир",
      "uk": "Алжир",
      "en": "Algeria",
      "pl": "Algieria"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.joradp.dz/FTP/jo-francais/2026/F2026036.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MA",
    "names": {
      "ru": "Марокко",
      "uk": "Марокко",
      "en": "Morocco",
      "pl": "Maroko"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://mandili.net/code/52-05/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "MU",
    "names": {
      "ru": "Маврикий",
      "uk": "Маврикій",
      "en": "Mauritius",
      "pl": "Mauritius"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://mauritiusassembly.govmu.org/mauritiusassembly/wp-content/uploads/2023/03/act1712.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "AO",
    "names": {
      "ru": "Ангола",
      "uk": "Ангола",
      "en": "Angola",
      "pl": "Angola"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.angolex.com/paginas/codigos/codigo-de-estrada.html",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "CI",
    "names": {
      "ru": "Кот-д’Ивуар",
      "uk": "Кот-д’Івуар",
      "en": "Ivory Coast",
      "pl": "Wybrzeże Kości Słoniowej"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://civlii.laws.africa/en/akn/ci/act/decree/2016/864/fra@2023-07-18",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TN",
    "names": {
      "ru": "Тунис",
      "uk": "Туніс",
      "en": "Tunisia",
      "pl": "Tunezja"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://lois.tn/code/route",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "RW",
    "names": {
      "ru": "Руанда",
      "uk": "Руанда",
      "en": "Rwanda",
      "pl": "Rwanda"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://police.gov.rw/uploads/tx_download/OG_n___Special_of_10.03.2026__Ikoreshwa_ry_umuhanda.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "UG",
    "names": {
      "ru": "Уганда",
      "uk": "Уганда",
      "en": "Uganda",
      "pl": "Uganda"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://media.ulii.org/media/legislation/18261/source_file/cac616465775ec02/1998-15.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "KE",
    "names": {
      "ru": "Кения",
      "uk": "Кенія",
      "en": "Kenya",
      "pl": "Kenia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://new.kenyalaw.org/akn/ke/act/gn/1953/1902/eng@2022-12-31",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "SN",
    "names": {
      "ru": "Сенегал",
      "uk": "Сенегал",
      "en": "Senegal",
      "pl": "Senegal"
    },
    "status": "known_limits",
    "wholeTerritory": true,
    "explanation": {
      "ru": "Национальный кодекс, article L.61, покрывает устройство или продукт, цель которого — предупреждать или сообщать место прибора фиксации. Регионального изъятия в открытом тексте нет.",
      "uk": "Національний кодекс, article L.61, покриває пристрій або продукт, мета якого — попереджати або повідомляти місце приладу фіксації. Регіонального винятку у відкритому тексті немає.",
      "en": "The national code, article L.61, covers a device or product meant to warn about or report the location of enforcement equipment. The open text has no regional exception.",
      "pl": "Krajowy kodeks, article L.61, obejmuje urządzenie lub produkt, którego celem jest ostrzegać lub podać miejsce urządzenia pomiarowego. Otwarty tekst nie ma wyjątku regionalnego."
    },
    "sourceUrl": "https://www.vie-publique.sn/docs/84c40147-2c79-43b5-9a51-056dabd8252e/JO-7520-du-27-avril-2022.pdf",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  },
  {
    "iso": "BW",
    "names": {
      "ru": "Ботсвана",
      "uk": "Ботсвана",
      "en": "Botswana",
      "pl": "Botswana"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.gov.bw/law-crime-and-justice/access-laws-botswana",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "NA",
    "names": {
      "ru": "Намибия",
      "uk": "Намібія",
      "en": "Namibia",
      "pl": "Namibia"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.lac.org.na/laws/2010/4473.pdf",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "TZ",
    "names": {
      "ru": "Танзания",
      "uk": "Танзанія",
      "en": "United Republic of Tanzania",
      "pl": "Tanzania"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://elibrary.osg.go.tz/server/api/core/bitstreams/73d4f24f-a615-43a3-ac46-64d370fbc670/content",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PG",
    "names": {
      "ru": "Папуа — Новая Гвинея",
      "uk": "Папуа — Нова Гвінея",
      "en": "Papua New Guinea",
      "pl": "Papua-Nowa Gwinea"
    },
    "status": "needs_review",
    "wholeTerritory": null,
    "explanation": {
      "ru": "Проверка не подтвердила, разрешено ли предупреждение о камерах. Это не записанный запрет и не разрешение.",
      "uk": "Перевірка не підтвердила, чи дозволено попередження про камери. Це не записана заборона і не дозвіл.",
      "en": "The check did not confirm whether camera warnings are allowed. This is not a recorded ban and not permission.",
      "pl": "Sprawdzenie nie potwierdziło, czy ostrzeżenia o kamerach są dozwolone. To nie jest zapisany zakaz ani zezwolenie."
    },
    "sourceUrl": "https://www.paclii.org/pg/legis/consol_act/mta1950153/",
    "checkedOn": "2026-10-22",
    "checkedFunctions": null
  },
  {
    "iso": "PS",
    "names": {
      "ru": "Палестина",
      "uk": "Палестина",
      "en": "Palestine",
      "pl": "Palestyna"
    },
    "status": "known_limits",
    "wholeTerritory": false,
    "explanation": {
      "ru": "Статья 116 закона № 5 от 2000 года ограничивает предупреждение о местах измерения скорости там, где применяется палестинский закон. Восточный Иерусалим источник не закрывает. Весь код PS ограничением не помечен.",
      "uk": "Стаття 116 закону № 5 від 2000 року обмежує попередження про місця вимірювання швидкості там, де застосовується палестинський закон. Східний Єрусалим джерело не закриває. Увесь код PS обмеженням не позначений.",
      "en": "Article 116 of Law No. 5 of 2000 restricts warnings about speed-measurement locations where Palestinian law applies. The source does not close East Jerusalem. The whole PS code is not marked restricted.",
      "pl": "Artykuł 116 ustawy nr 5 z 2000 roku ogranicza ostrzeżenia o miejscach pomiaru prędkości tam, gdzie stosuje się prawo palestyńskie. Źródło nie zamyka Wschodniej Jerozolimy. Cały kod PS nie jest oznaczony jako objęty ograniczeniem."
    },
    "sourceUrl": "https://laws-portal.najah.edu/legislation/79/item/4533/",
    "checkedOn": "2026-10-21",
    "checkedFunctions": null
  }
];

export function statusLabel(status, locale = "ru") {
  const labels = STATUS_LABELS[locale] || STATUS_LABELS.ru;
  return labels[status] || status;
}

export function searchLegalNotices(query, locale = "ru") {
  const needle = String(query || "").trim().toLowerCase();
  const rows = NOTICES.filter((notice) => {
    if (!needle) return true;
    const blob = [
      notice.iso,
      ...Object.values(notice.names),
      ...Object.values(notice.explanation),
      ...Object.values(STATUS_LABELS).map((labels) => labels[notice.status]),
    ].join(" ").toLowerCase();
    return blob.includes(needle);
  });
  const lang = STATUS_LABELS[locale] ? locale : "ru";
  return rows.sort((a, b) => a.names[lang].localeCompare(b.names[lang], lang));
}
