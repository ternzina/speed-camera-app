// In-app instructions. The wording follows the current trip, voice, and
// permission code. It does not add a permission requirement of its own.

const COPY = {
  ru: {
    title: "Как пользоваться",
    back: "Назад",
    sections: [
      {
        title: "Голосовая навигация",
        paragraphs: [
          "Откройте вкладку «Поездка». В настройках должны быть включены «Голос» и предупреждения о камерах: подсказки маршрута используют тот же голос.",
          "Голос поворотов появляется после кнопки «В путь». Кнопка «Начать поездку» включает GPS и предупреждения о камерах, но не произносит манёвры маршрута.",
        ],
      },
      {
        title: "Маршрут и кнопка «В путь»",
        paragraphs: [
          "Найдите адрес или выберите точку на карте, нажмите «Построить маршрут», затем «В путь».",
          "Google произносит ближайший поворот сразу после «В путь», в том числе дома и без движения. От скорости эта фраза не зависит.",
          "Пока звучит предупреждение о камере, подсказки Google замолкают и возвращаются после него.",
        ],
      },
      {
        title: "Предупреждения о камерах без маршрута",
        paragraphs: [
          "Нажмите «Начать поездку». Приложение следит за GPS и камерами выбранной страны.",
          "Это отдельные фразы о камерах, не голос поворотов. Они звучат, когда камера впереди по ходу движения.",
          "Ту же камеру приложение не повторяет, пока вы не приблизились к ней ещё на 250 метров.",
        ],
      },
      {
        title: "Открытое приложение",
        paragraphs: [
          "Для карты, поездки и голоса на открытом экране достаточно геолокации «При использовании». Разрешения «Всегда» и уведомления для этого не нужны.",
          "Поиск адреса и построение маршрута требуют интернет. База камер, уже загруженная на телефон, работает без сети.",
        ],
      },
      {
        title: "Фоновая работа",
        paragraphs: [
          "Фон включается в настройках переключателем «Фоновый режим». Чтобы предупреждения продолжались при заблокированном экране, нужна геолокация «Всегда».",
          "Фоновая сессия также запрашивает уведомления. Если отказать, фоновая сессия не запускается. Поездка и голос на открытом экране при этом продолжаются.",
          "После принудительного закрытия приложения сессию нужно начать снова.",
        ],
      },
      {
        title: "Если голос не слышен",
        paragraphs: [
          "Проверьте переключатель «Голос», предупреждения о камерах и громкость телефона.",
          "Для поворотов должен быть построен маршрут и нажата «В путь», а не только «Начать поездку». Язык фраз Google совпадает с языком iPhone.",
          "Для поворотов скорость не нужна. Геолокация должна быть разрешена при использовании приложения.",
        ],
      },
    ],
  },
  uk: {
    title: "Як користуватися",
    back: "Назад",
    sections: [
      {
        title: "Голосова навігація",
        paragraphs: [
          "Відкрийте вкладку «Поїздка». У налаштуваннях мають бути ввімкнені «Голос» і попередження про камери: підказки маршруту використовують той самий голос.",
          "Голос поворотів з’являється після кнопки «У дорогу». Кнопка «Почати поїздку» вмикає GPS і попередження про камери, але не промовляє маневри маршруту.",
        ],
      },
      {
        title: "Маршрут і кнопка «У дорогу»",
        paragraphs: [
          "Знайдіть адресу або виберіть точку на карті, натисніть «Побудувати маршрут», потім «У дорогу».",
          "Google промовляє найближчий поворот одразу після «У дорогу», зокрема вдома і без руху. Від швидкості ця фраза не залежить.",
          "Поки лунає попередження про камеру, підказки Google замовкають і повертаються після нього.",
        ],
      },
      {
        title: "Попередження про камери без маршруту",
        paragraphs: [
          "Натисніть «Почати поїздку». Застосунок стежить за GPS і камерами вибраної країни.",
          "Це окремі фрази про камери, не голос поворотів. Вони лунають, коли камера попереду за напрямком руху.",
          "Ту саму камеру застосунок не повторює, доки ви не наблизилися до неї ще на 250 метрів.",
        ],
      },
      {
        title: "Відкритий застосунок",
        paragraphs: [
          "Для карти, поїздки й голосу на відкритому екрані достатньо геолокації «Під час використання». Дозволи «Завжди» та сповіщення для цього не потрібні.",
          "Пошук адреси й побудова маршруту потребують інтернету. База камер, уже завантажена на телефон, працює без мережі.",
        ],
      },
      {
        title: "Робота у фоні",
        paragraphs: [
          "Фон вмикається в налаштуваннях перемикачем «Фоновий режим». Щоб попередження тривали при заблокованому екрані, потрібна геолокація «Завжди».",
          "Фонова сесія також запитує сповіщення. Якщо відмовити, фонова сесія не запускається. Поїздка й голос на відкритому екрані при цьому тривають.",
          "Після примусового закриття застосунку сесію потрібно почати знову.",
        ],
      },
      {
        title: "Якщо голос не чутно",
        paragraphs: [
          "Перевірте перемикач «Голос», попередження про камери та гучність телефона.",
          "Для поворотів має бути побудований маршрут і натиснуто «У дорогу», а не лише «Почати поїздку». Мова фраз Google збігається з мовою iPhone.",
          "Для поворотів швидкість не потрібна. Геолокація має бути дозволена під час використання застосунку.",
        ],
      },
    ],
  },
  en: {
    title: "How to use",
    back: "Back",
    sections: [
      {
        title: "Voice navigation",
        paragraphs: [
          "Open the Drive tab. Voice and camera warnings both need to be on in Settings: route prompts use that same voice switch.",
          "Turn prompts start after Start guidance. Start trip turns on GPS and camera warnings, and does not speak route maneuvers.",
        ],
      },
      {
        title: "A route and Start guidance",
        paragraphs: [
          "Search for an address or pick a point, tap Build route, then Start guidance.",
          "Google speaks the next turn right after Start guidance, including at home while standing still. That phrase does not depend on speed.",
          "While a camera warning is speaking, Google stays quiet and returns when the warning ends.",
        ],
      },
      {
        title: "Camera warnings without a route",
        paragraphs: [
          "Tap Start trip. The app watches GPS and the selected country’s cameras.",
          "These are camera phrases, separate from turn prompts. They play when a camera is ahead in the direction of travel.",
          "The same camera is not repeated until you are another 250 meters closer.",
        ],
      },
      {
        title: "While the app is open",
        paragraphs: [
          "While Using location is enough for the map, the trip, and voice on an open screen. Always and notifications are not required for that.",
          "Address search and route building need the internet. A camera database already saved on the phone works offline.",
        ],
      },
      {
        title: "Background",
        paragraphs: [
          "Turn background on with the Background mode switch in Settings. Warnings while the screen is locked need Always location.",
          "The background session also asks for notifications. If you deny them, that session does not start. The open-screen trip and voice continue.",
          "After force-quitting the app, start the session again.",
        ],
      },
      {
        title: "If you hear no voice",
        paragraphs: [
          "Check the Voice switch, camera warnings, and the phone volume.",
          "For turns, a route must be built and Start guidance pressed, not only Start trip. Google phrases follow the iPhone language.",
          "Turns do not need speed. Location must be allowed while using the app.",
        ],
      },
    ],
  },
  pl: {
    title: "Jak korzystać",
    back: "Wstecz",
    sections: [
      {
        title: "Nawigacja głosowa",
        paragraphs: [
          "Otwórz kartę Jazda. W ustawieniach muszą być włączone Głos i ostrzeżenia o kamerach: podpowiedzi trasy używają tego samego głosu.",
          "Głos skrętów pojawia się po przycisku W drogę. Przycisk Rozpocznij przejazd włącza GPS i ostrzeżenia o kamerach, ale nie wypowiada manewrów trasy.",
        ],
      },
      {
        title: "Trasa i przycisk W drogę",
        paragraphs: [
          "Znajdź adres albo wybierz punkt na mapie, stuknij Wyznacz trasę, a potem W drogę.",
          "Google wypowiada najbliższy skręt zaraz po W drogę, także w domu i bez ruchu. Ta fraza nie zależy od prędkości.",
          "Gdy mówi ostrzeżenie o kamerze, podpowiedzi Google milkną i wracają po nim.",
        ],
      },
      {
        title: "Ostrzeżenia o kamerach bez trasy",
        paragraphs: [
          "Stuknij Rozpocznij przejazd. Aplikacja śledzi GPS i kamery wybranego kraju.",
          "To osobne frazy o kamerach, nie głos skrętów. Brzmią, gdy kamera jest z przodu, w kierunku jazdy.",
          "Tej samej kamery aplikacja nie powtarza, dopóki nie zbliżysz się o kolejne 250 metrów.",
        ],
      },
      {
        title: "Otwarta aplikacja",
        paragraphs: [
          "Do mapy, przejazdu i głosu na otwartym ekranie wystarczy lokalizacja Podczas używania. Zawsze i powiadomienia nie są do tego potrzebne.",
          "Szukanie adresu i wyznaczanie trasy wymagają internetu. Baza kamer zapisana w telefonie działa offline.",
        ],
      },
      {
        title: "Praca w tle",
        paragraphs: [
          "Tło włącza się w ustawieniach przełącznikiem Tryb w tle. Ostrzeżenia przy zablokowanym ekranie wymagają lokalizacji Zawsze.",
          "Sesja w tle prosi też o powiadomienia. Odmowa zatrzymuje tylko tę sesję. Przejazd i głos na otwartym ekranie trwają dalej.",
          "Po wymuszonym zamknięciu aplikacji sesję trzeba uruchomić ponownie.",
        ],
      },
      {
        title: "Gdy głosu nie słychać",
        paragraphs: [
          "Sprawdź przełącznik Głos, ostrzeżenia o kamerach i głośność telefonu.",
          "Do skrętów potrzebna jest trasa i przycisk W drogę, a nie samo Rozpocznij przejazd. Frazy Google są w języku iPhone’a.",
          "Skręty nie wymagają prędkości. Lokalizacja musi być dozwolona podczas używania aplikacji.",
        ],
      },
    ],
  },
};

export function howToUseCopy(language) {
  return COPY[language] || COPY.ru;
}
