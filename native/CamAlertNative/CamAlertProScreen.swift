import StoreKit
import UIKit

/// The iOS PRO screen from premium-screen.js. The road photograph is the
/// original assets/pro-evening-road.png. Slide marks follow premium-pro-art.js.
final class PremiumViewController: UIViewController {
  private let evening = UIColor(red: 8 / 255, green: 15 / 255, blue: 41 / 255, alpha: 1)
  private let gold = UIColor(red: 255 / 255, green: 198 / 255, blue: 41 / 255, alpha: 1)
  private let cream = UIColor(red: 246 / 255, green: 244 / 255, blue: 241 / 255, alpha: 1)
  private let headlineColor = UIColor(red: 255 / 255, green: 229 / 255, blue: 154 / 255, alpha: 1)
  private let slides: [(id: String, title: String, text: String)] = [
    ("cameras", "Камеры", "Предупреждение до камеры, на экране и голосом."),
    ("navigation", "Навигация", "Маршрут и ведение по дороге."),
    ("voice", "Голос", "Повороты и камеры произносятся вслух."),
    ("background", "Фон", "Предупреждения идут и при погашенном экране."),
    ("settings", "Настройки", "Дистанция, звуки и оформление поездки."),
  ]
  private var products: [Product] = []
  private var selected = "camalert_premium_yearly"
  private let planRow = UIStackView()
  private let terms = UILabel()
  private let note = UILabel()
  private let buyButton = UIButton(type: .system)
  private let trialNote = UILabel()
  private let statusCard = UIView()
  private let planValue = UILabel()
  private let renewalValue = UILabel()
  private let renewalRow = UIStackView()
  private let stage = UIScrollView()
  private let strip = UIStackView()
  private let dots = UIStackView()
  private let closeButton = UIButton(type: .system)
  private var cardWidth: CGFloat = 280
  private var contentBottom: NSLayoutConstraint?
  private var heroTextTop: NSLayoutConstraint?
  private var stagePage = 0
  private var stageTimer: Timer?
  private var waitingToBuy = false
  private var buying = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = evening
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    scroll.alwaysBounceVertical = true
    scroll.contentInsetAdjustmentBehavior = .never
    scroll.delaysContentTouches = false
    scroll.canCancelContentTouches = false
    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 7
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll)
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      scroll.topAnchor.constraint(equalTo: view.topAnchor),
      scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -32),
    ])
    stack.addArrangedSubview(hero())
    stack.addArrangedSubview(stageFrame())
    stack.addArrangedSubview(makeStatusCard())
    planRow.axis = .vertical
    planRow.spacing = 8
    planRow.distribution = .fillEqually
    stack.addArrangedSubview(planRow)
    terms.numberOfLines = 2
    terms.textAlignment = .center
    terms.textColor = cream
    terms.font = .camalert(13, weight: .semibold)
    stack.addArrangedSubview(terms)
    note.numberOfLines = 0
    note.textAlignment = .center
    note.textColor = UIColor(red: 213 / 255, green: 217 / 255, blue: 232 / 255, alpha: 1)
    note.font = .camalert(11)
    note.text = ""
    stack.addArrangedSubview(note)
    trialNote.numberOfLines = 0
    trialNote.textAlignment = .center
    trialNote.textColor = gold
    trialNote.font = .camalert(14, weight: .semibold)
    stack.addArrangedSubview(trialNote)
    stack.addArrangedSubview(unlockButton())
    stack.addArrangedSubview(link("↻  Восстановить покупки", action: #selector(restorePurchases)))
    stack.addArrangedSubview(link("Управление подпиской", action: #selector(manage)))
    contentBottom = stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -18)
    contentBottom?.isActive = true
    showPlans(prices: [:])
    refreshBuyButton()
    NotificationCenter.default.addObserver(self, selector: #selector(premiumChanged), name: .camalertPremium, object: nil)
    applyPremiumState()
    closeButton.setTitle("×", for: .normal)
    closeButton.setTitleColor(cream, for: .normal)
    closeButton.titleLabel?.font = .camalert(26, weight: .light)
    closeButton.layer.cornerRadius = 18
    closeButton.layer.borderWidth = 1
    closeButton.layer.borderColor = UIColor(white: 1, alpha: 0.45).cgColor
    closeButton.backgroundColor = UIColor(red: 6 / 255, green: 12 / 255, blue: 34 / 255, alpha: 0.55)
    closeButton.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    closeButton.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(closeButton)
    NSLayoutConstraint.activate([
      closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 6),
      closeButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
      closeButton.widthAnchor.constraint(equalToConstant: 36),
      closeButton.heightAnchor.constraint(equalToConstant: 36),
    ])
    Task { await loadProducts() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    applyPremiumState()
    Task { await PremiumStore.shared.refresh() }
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if cardWidth > 0, strip.arrangedSubviews.isEmpty { layoutCards() }
    if ProcessInfo.processInfo.arguments.contains("--premium-end"), let scroll = view.subviews.first as? UIScrollView {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
        let y = max(0, scroll.contentSize.height - scroll.bounds.height)
        scroll.setContentOffset(CGPoint(x: 0, y: y), animated: false)
      }
    }
    stageTimer?.invalidate()
    stageTimer = Timer.scheduledTimer(withTimeInterval: 4.5, repeats: true) { [weak self] _ in
      self?.advanceStage()
    }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    stageTimer?.invalidate()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    contentBottom?.constant = -(view.safeAreaInsets.bottom + 16)
    heroTextTop?.constant = max(view.safeAreaInsets.top + 8, 78)
    let width = max(210, stage.bounds.width - 48)
    guard abs(width - cardWidth) > 1, stage.bounds.width > 0 else { return }
    cardWidth = width
    layoutCards()
  }

  private func hero() -> UIView {
    let image = UIImageView(image: UIImage(named: "pro-evening-road"))
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.translatesAutoresizingMaskIntoConstraints = false
    image.heightAnchor.constraint(equalToConstant: 220).isActive = true
    let shade = UIView()
    shade.backgroundColor = UIColor(red: 4 / 255, green: 10 / 255, blue: 31 / 255, alpha: 0.24)
    shade.translatesAutoresizingMaskIntoConstraints = false
    let camera = cameraMark()
    let logo = UILabel()
    logo.text = "CamAlert"
    logo.textColor = cream
    logo.font = .camalert(20, weight: .heavy)
    let pro = UILabel()
    pro.text = " PRO "
    pro.textColor = UIColor(red: 9 / 255, green: 14 / 255, blue: 35 / 255, alpha: 1)
    pro.backgroundColor = gold
    pro.font = .camalert(18, weight: .black)
    pro.layer.cornerRadius = 12
    pro.clipsToBounds = true
    let brand = UIStackView(arrangedSubviews: [camera, logo, pro])
    brand.axis = .horizontal
    brand.alignment = .center
    brand.spacing = 7
    let title = UILabel()
    title.text = "Штрафы в прошлом"
    title.textColor = headlineColor
    title.font = .italicSystemFont(ofSize: 22).withWeight(.black)
    title.adjustsFontSizeToFitWidth = true
    title.minimumScaleFactor = 0.75
    title.textAlignment = .center
    title.numberOfLines = 2
    let swoosh = UIView()
    swoosh.backgroundColor = gold
    swoosh.layer.cornerRadius = 2
    swoosh.transform = CGAffineTransform(rotationAngle: -3 * .pi / 180)
    swoosh.translatesAutoresizingMaskIntoConstraints = false
    swoosh.heightAnchor.constraint(equalToConstant: 4).isActive = true
    let lead = UILabel()
    lead.text = "Предупреждения о камерах, удобная навигация и уверенность в дороге."
    lead.textColor = cream
    lead.font = .camalert(13, weight: .medium)
    lead.textAlignment = .center
    lead.numberOfLines = 2
    let column = UIStackView(arrangedSubviews: [brand, title, swoosh, lead])
    column.axis = .vertical
    column.alignment = .center
    column.spacing = 4
    column.translatesAutoresizingMaskIntoConstraints = false
    column.isUserInteractionEnabled = false
    image.addSubview(shade)
    image.addSubview(column)
    heroTextTop = column.topAnchor.constraint(equalTo: image.topAnchor, constant: 54)
    NSLayoutConstraint.activate([
      shade.topAnchor.constraint(equalTo: image.topAnchor),
      shade.leadingAnchor.constraint(equalTo: image.leadingAnchor),
      shade.trailingAnchor.constraint(equalTo: image.trailingAnchor),
      shade.bottomAnchor.constraint(equalTo: image.bottomAnchor),
      column.centerXAnchor.constraint(equalTo: image.centerXAnchor),
      heroTextTop!,
      column.leadingAnchor.constraint(greaterThanOrEqualTo: image.leadingAnchor, constant: 56),
      column.trailingAnchor.constraint(lessThanOrEqualTo: image.trailingAnchor, constant: -24),
      swoosh.widthAnchor.constraint(equalToConstant: 180),
    ])
    let wrap = UIView()
    wrap.translatesAutoresizingMaskIntoConstraints = false
    wrap.addSubview(image)
    NSLayoutConstraint.activate([
      image.topAnchor.constraint(equalTo: wrap.topAnchor),
      image.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: -16),
      image.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: 16),
      image.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
    ])
    return wrap
  }

  private func cameraMark() -> UIView {
    let box = UIView()
    box.translatesAutoresizingMaskIntoConstraints = false
    box.widthAnchor.constraint(equalToConstant: 31).isActive = true
    box.heightAnchor.constraint(equalToConstant: 28).isActive = true
    box.layer.cornerRadius = 8
    box.layer.borderWidth = 2
    box.layer.borderColor = gold.cgColor
    box.backgroundColor = UIColor(red: 8 / 255, green: 15 / 255, blue: 41 / 255, alpha: 0.7)
    let lens = UIView()
    lens.translatesAutoresizingMaskIntoConstraints = false
    lens.layer.cornerRadius = 6
    lens.layer.borderWidth = 3
    lens.layer.borderColor = gold.cgColor
    box.addSubview(lens)
    NSLayoutConstraint.activate([
      lens.centerXAnchor.constraint(equalTo: box.centerXAnchor),
      lens.centerYAnchor.constraint(equalTo: box.centerYAnchor),
      lens.widthAnchor.constraint(equalToConstant: 12),
      lens.heightAnchor.constraint(equalToConstant: 12),
    ])
    return box
  }

  private func stageFrame() -> UIView {
    let frame = UIView()
    frame.backgroundColor = .clear
    frame.translatesAutoresizingMaskIntoConstraints = false
    frame.heightAnchor.constraint(equalToConstant: 176).isActive = true
    stage.showsHorizontalScrollIndicator = false
    stage.alwaysBounceHorizontal = true
    stage.isDirectionalLockEnabled = true
    stage.clipsToBounds = true
    stage.delegate = self
    stage.translatesAutoresizingMaskIntoConstraints = false
    strip.axis = .horizontal
    strip.spacing = 12
    strip.alignment = .fill
    strip.translatesAutoresizingMaskIntoConstraints = false
    stage.addSubview(strip)
    dots.axis = .horizontal
    dots.spacing = 6
    dots.translatesAutoresizingMaskIntoConstraints = false
    frame.addSubview(stage)
    frame.addSubview(dots)
    NSLayoutConstraint.activate([
      stage.topAnchor.constraint(equalTo: frame.topAnchor),
      stage.leadingAnchor.constraint(equalTo: frame.leadingAnchor, constant: -16),
      stage.trailingAnchor.constraint(equalTo: frame.trailingAnchor, constant: 16),
      stage.heightAnchor.constraint(equalToConstant: 160),
      strip.topAnchor.constraint(equalTo: stage.contentLayoutGuide.topAnchor),
      strip.leadingAnchor.constraint(equalTo: stage.contentLayoutGuide.leadingAnchor, constant: 16),
      strip.trailingAnchor.constraint(equalTo: stage.contentLayoutGuide.trailingAnchor, constant: -16),
      strip.bottomAnchor.constraint(equalTo: stage.contentLayoutGuide.bottomAnchor),
      strip.heightAnchor.constraint(equalTo: stage.frameLayoutGuide.heightAnchor),
      dots.centerXAnchor.constraint(equalTo: frame.centerXAnchor),
      dots.bottomAnchor.constraint(equalTo: frame.bottomAnchor),
    ])
    for index in slides.indices {
      let dot = UIView()
      dot.tag = index
      dot.backgroundColor = index == 0 ? gold : UIColor(white: 1, alpha: 0.35)
      dot.layer.cornerRadius = 4
      dot.translatesAutoresizingMaskIntoConstraints = false
      dot.widthAnchor.constraint(equalToConstant: index == 0 ? 18 : 8).isActive = true
      dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
      dots.addArrangedSubview(dot)
    }
    return frame
  }

  private var cardStride: CGFloat { cardWidth + 12 }

  private func layoutCards() {
    strip.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let loop = slides + Array(slides.prefix(min(2, slides.count)))
    for slide in loop {
      let card = ProSlideCard(slide: slide, photo: UIImage(named: "pro-evening-road"), gold: gold, cream: cream)
      card.translatesAutoresizingMaskIntoConstraints = false
      card.widthAnchor.constraint(equalToConstant: cardWidth).isActive = true
      strip.addArrangedSubview(card)
    }
    let page = min(max(stagePage, 0), slides.count - 1)
    stagePage = page
    stage.layoutIfNeeded()
    stage.setContentOffset(CGPoint(x: CGFloat(page) * cardStride, y: 0), animated: false)
  }

  private func makeStatusCard() -> UIView {
    statusCard.backgroundColor = UIColor(red: 16 / 255, green: 26 / 255, blue: 58 / 255, alpha: 1)
    statusCard.layer.cornerRadius = 16
    statusCard.layer.borderWidth = 1
    statusCard.layer.borderColor = UIColor(red: 255 / 255, green: 198 / 255, blue: 41 / 255, alpha: 0.45).cgColor
    statusCard.isHidden = true
    let badge = UIImageView(image: UIImage(systemName: "crown.fill"))
    badge.tintColor = gold
    badge.contentMode = .scaleAspectFit
    badge.translatesAutoresizingMaskIntoConstraints = false
    badge.widthAnchor.constraint(equalToConstant: 22).isActive = true
    badge.heightAnchor.constraint(equalToConstant: 22).isActive = true
    let title = UILabel()
    title.text = "CamAlert Premium"
    title.textColor = cream
    title.font = .camalert(18, weight: .heavy)
    let status = UILabel()
    status.text = "Подписка активна"
    status.textColor = UIColor(red: 47 / 255, green: 196 / 255, blue: 112 / 255, alpha: 1)
    status.font = .camalert(13, weight: .semibold)
    let heading = UIStackView(arrangedSubviews: [title, status])
    heading.axis = .vertical
    heading.spacing = 2
    let head = UIStackView(arrangedSubviews: [badge, heading])
    head.axis = .horizontal
    head.alignment = .center
    head.spacing = 10
    planValue.textColor = cream
    planValue.font = .camalert(15, weight: .semibold)
    planValue.textAlignment = .right
    renewalValue.textColor = cream
    renewalValue.font = .camalert(15, weight: .semibold)
    renewalValue.textAlignment = .right
    renewalValue.numberOfLines = 2
    let tariff = statusLine("Ваш тариф", planValue)
    renewalRow.axis = .horizontal
    renewalRow.alignment = .firstBaseline
    renewalRow.spacing = 12
    let renewalTitle = UILabel()
    renewalTitle.text = "Следующее продление"
    renewalTitle.textColor = UIColor(red: 186 / 255, green: 196 / 255, blue: 214 / 255, alpha: 1)
    renewalTitle.font = .camalert(14)
    renewalRow.addArrangedSubview(renewalTitle)
    renewalRow.addArrangedSubview(renewalValue)
    let note = UILabel()
    note.text = "Все функции Premium доступны"
    note.textColor = cream
    note.font = .camalert(14, weight: .semibold)
    note.numberOfLines = 0
    let detail = UILabel()
    detail.text = "Навигация, предупреждения о камерах и другие возможности вашего тарифа."
    detail.textColor = UIColor(red: 186 / 255, green: 196 / 255, blue: 214 / 255, alpha: 1)
    detail.font = .camalert(12)
    detail.numberOfLines = 0
    let column = UIStackView(arrangedSubviews: [head, tariff, renewalRow, note, detail])
    column.axis = .vertical
    column.spacing = 10
    column.translatesAutoresizingMaskIntoConstraints = false
    column.isLayoutMarginsRelativeArrangement = true
    column.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    statusCard.addSubview(column)
    NSLayoutConstraint.activate([
      column.topAnchor.constraint(equalTo: statusCard.topAnchor),
      column.leadingAnchor.constraint(equalTo: statusCard.leadingAnchor),
      column.trailingAnchor.constraint(equalTo: statusCard.trailingAnchor),
      column.bottomAnchor.constraint(equalTo: statusCard.bottomAnchor),
    ])
    return statusCard
  }

  private func statusLine(_ title: String, _ value: UILabel) -> UIStackView {
    let label = UILabel()
    label.text = title
    label.textColor = UIColor(red: 186 / 255, green: 196 / 255, blue: 214 / 255, alpha: 1)
    label.font = .camalert(14)
    label.setContentHuggingPriority(.defaultLow, for: .horizontal)
    value.setContentCompressionResistancePriority(.required, for: .horizontal)
    let row = UIStackView(arrangedSubviews: [label, value])
    row.axis = .horizontal
    row.alignment = .firstBaseline
    row.spacing = 12
    return row
  }

  private func unlockButton() -> UIButton {
    buyButton.setTitle("Разблокировать PRO  ›", for: .normal)
    buyButton.setTitleColor(UIColor(red: 17 / 255, green: 16 / 255, blue: 26 / 255, alpha: 1), for: .normal)
    buyButton.setTitleColor(UIColor(red: 17 / 255, green: 16 / 255, blue: 26 / 255, alpha: 0.45), for: .disabled)
    buyButton.titleLabel?.font = .camalert(16, weight: .black)
    buyButton.titleLabel?.adjustsFontSizeToFitWidth = true
    buyButton.titleLabel?.minimumScaleFactor = 0.75
    buyButton.backgroundColor = gold
    buyButton.layer.cornerRadius = 16
    buyButton.layer.borderWidth = 1
    buyButton.layer.borderColor = UIColor(red: 255 / 255, green: 228 / 255, blue: 125 / 255, alpha: 1).cgColor
    buyButton.heightAnchor.constraint(equalToConstant: 52).isActive = true
    buyButton.isExclusiveTouch = true
    buyButton.addTarget(self, action: #selector(buyTouchDown), for: .touchDown)
    buyButton.addTarget(self, action: #selector(buyTouchUp), for: .touchUpOutside)
    buyButton.addTarget(self, action: #selector(buyTouchUp), for: .touchCancel)
    buyButton.addTarget(self, action: #selector(buySelected), for: .touchUpInside)
    return buyButton
  }

  @objc private func buyTouchDown() { buyButton.alpha = 0.72 }

  @objc private func buyTouchUp() { buyButton.alpha = 1 }

  private func refreshBuyButton() {
    buyButton.isEnabled = true
    if !buying { buyButton.alpha = 1 }
  }

  private func link(_ title: String, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(cream, for: .normal)
    button.titleLabel?.font = .camalert(13, weight: .semibold)
    button.addTarget(self, action: action, for: .touchUpInside)
    button.heightAnchor.constraint(equalToConstant: 32).isActive = true
    return button
  }

  private func showPlans(prices: [String: String]) {
    planRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let names = [
      "camalert_premium_weekly": "Неделя",
      "camalert_premium_monthly": "Месяц",
      "camalert_premium_yearly": "Год",
      "camalert_premium_lifetime": "Навсегда",
    ]
    let waiting = "Цена появится из магазина"
    var row: UIStackView?
    for (index, id) in PremiumAccess.plans.enumerated() {
      if index % 2 == 0 {
        let line = UIStackView()
        line.axis = .horizontal
        line.spacing = 8
        line.distribution = .fillEqually
        row = line
        planRow.addArrangedSubview(line)
      }
      let button = UIButton(type: .custom)
      let price = prices[id] ?? waiting
      let chosen = id == selected
      button.backgroundColor = chosen
        ? UIColor(red: 142 / 255, green: 95 / 255, blue: 24 / 255, alpha: 0.55)
        : UIColor(red: 19 / 255, green: 28 / 255, blue: 62 / 255, alpha: 0.82)
      button.layer.cornerRadius = 14
      button.layer.borderWidth = chosen ? 2 : 1
      button.layer.borderColor = (chosen ? gold : UIColor(white: 1, alpha: 0.16)).cgColor
      let period = UILabel()
      period.text = names[id] ?? id
      period.textColor = cream
      period.font = .camalert(15, weight: .heavy)
      period.textAlignment = .center
      period.numberOfLines = 1
      period.adjustsFontSizeToFitWidth = true
      period.minimumScaleFactor = 0.7
      let priceLabel = UILabel()
      priceLabel.text = id == "camalert_premium_yearly" ? "\(price)\n\(shortTrial(for: id))" : price
      priceLabel.textColor = cream
      priceLabel.font = .camalert(11, weight: .semibold)
      priceLabel.textAlignment = .center
      priceLabel.numberOfLines = 2
      priceLabel.lineBreakMode = .byWordWrapping
      let column = UIStackView(arrangedSubviews: [period, priceLabel])
      column.axis = .vertical
      column.spacing = 2
      column.isUserInteractionEnabled = false
      column.translatesAutoresizingMaskIntoConstraints = false
      button.addSubview(column)
      NSLayoutConstraint.activate([
        column.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: 8),
        column.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -8),
        column.centerYAnchor.constraint(equalTo: button.centerYAnchor),
      ])
      button.heightAnchor.constraint(equalToConstant: 76).isActive = true
      button.addAction(UIAction { [weak self] _ in
        self?.selected = id
        self?.showPlans(prices: prices)
        self?.refreshBuyButton()
      }, for: .touchUpInside)
      row?.addArrangedSubview(button)
    }
    let price = prices[selected] ?? waiting
    if selected == "camalert_premium_yearly" {
      terms.text = "\(shortTrial(for: selected)), затем \(price) в год"
    } else {
      terms.text = "\(names[selected] ?? "") · \(price)"
    }
    updateTrialNote()
    refreshBuyButton()
  }

  private func shortTrial(for id: String) -> String {
    if let product = products.first(where: { $0.id == id }), let phrase = Self.freeTrialPhrase(product) {
      return phrase
    }
    return "3 дня бесплатно"
  }

  private func updateTrialNote() {
    let active = PremiumStore.shared.subscribed || ProcessInfo.processInfo.arguments.contains("--premium-card")
    trialNote.isHidden = active
    guard !active else { return }
    let offer = products.first { $0.id == "camalert_premium_yearly" }.flatMap { Self.freeTrialPhrase($0) } ?? "3 дня бесплатно"
    trialNote.text = "\(offer) для новых покупателей с годовой подпиской. Дальше она продлевается сама, пока её не отменят."
  }

  private static func freeTrialPhrase(_ product: Product) -> String? {
    guard let offer = product.subscription?.introductoryOffer, offer.paymentMode == .freeTrial else { return nil }
    let count = offer.period.value * max(offer.periodCount, 1)
    switch offer.period.unit {
    case .day:
      return "\(count) \(PremiumAccess.count(count, one: "день", few: "дня", many: "дней")) бесплатно"
    case .week:
      return "\(count) \(PremiumAccess.count(count, one: "неделя", few: "недели", many: "недель")) бесплатно"
    case .month:
      return "\(count) \(PremiumAccess.count(count, one: "месяц", few: "месяца", many: "месяцев")) бесплатно"
    case .year:
      return "\(count) \(PremiumAccess.count(count, one: "год", few: "года", many: "лет")) бесплатно"
    default:
      return "Пробный период бесплатно"
    }
  }

  private func loadProducts() async {
    let loaded = (try? await Product.products(for: PremiumAccess.plans)) ?? []
    var prices: [String: String] = [:]
    for product in loaded { prices[product.id] = product.displayPrice }
    products = loaded
    await MainActor.run {
      self.showPlans(prices: prices)
      self.refreshBuyButton()
      if loaded.isEmpty { self.note.text = "" }
      if self.waitingToBuy { self.buySelected() }
    }
  }

  @objc private func buySelected() {
    buyTouchUp()
    guard !buying else { return }
    guard let product = products.first(where: { $0.id == selected }) else {
      waitingToBuy = true
      note.text = "Открываем оплату…"
      return
    }
    waitingToBuy = false
    buying = true
    Task {
      defer { Task { @MainActor in self.buying = false } }
      do {
        let result = try await product.purchase()
        if case .success(let verification) = result, case .verified = verification {
          await PremiumStore.shared.refresh()
          await MainActor.run {
            self.applyPremiumState()
            if !PremiumStore.shared.subscribed {
              self.note.text = "Магазин подтвердил покупку: \(product.displayName)"
            }
          }
        }
      } catch {
        await MainActor.run { self.note.text = "Покупка не завершилась" }
      }
    }
  }

  @objc private func restorePurchases() {
    Task {
      try? await AppStore.sync()
      await PremiumStore.shared.refresh()
      await MainActor.run {
        self.applyPremiumState()
        if !PremiumStore.shared.subscribed {
          self.note.text = "Запрос восстановления отправлен в App Store."
        }
      }
    }
  }

  @objc private func premiumChanged() { applyPremiumState() }

  private func applyPremiumState() {
    let preview = ProcessInfo.processInfo.arguments.contains("--premium-card")
    let store = PremiumStore.shared
    let active = store.subscribed || preview
    statusCard.isHidden = !active
    planRow.isHidden = active
    terms.isHidden = active
    buyButton.isHidden = active
    updateTrialNote()
    guard active else { return }
    let productId = store.subscribed ? store.productId : "camalert_premium_monthly"
    planValue.text = PremiumAccess.planTitle(productId)
    let expires: Double? = store.subscribed ? store.expiresAt : Date().addingTimeInterval(30 * 24 * 60 * 60).timeIntervalSince1970 * 1000
    if productId?.hasSuffix("lifetime") == true || expires == nil {
      renewalRow.isHidden = true
    } else if let expires {
      let formatter = DateFormatter()
      formatter.locale = Locale(identifier: "ru_RU")
      formatter.dateStyle = .long
      formatter.timeStyle = .none
      renewalValue.text = formatter.string(from: Date(timeIntervalSince1970: expires / 1000))
      renewalRow.isHidden = false
    }
  }

  @objc private func manage() {
    if let url = URL(string: "https://apps.apple.com/account/subscriptions") { UIApplication.shared.open(url) }
  }

  private func advanceStage() {
    guard slides.count > 1, cardWidth > 0, stage.isDragging == false, stage.isTracking == false, stage.isDecelerating == false else { return }
    if stagePage >= slides.count { settleLoop() }
    stagePage += 1
    stage.setContentOffset(CGPoint(x: CGFloat(stagePage) * cardStride, y: 0), animated: true)
  }

  private func settleLoop() {
    guard cardStride > 0, slides.count > 1 else { return }
    let page = Int(round(stage.contentOffset.x / cardStride))
    guard page >= slides.count else { return }
    stagePage = page % slides.count
    stage.setContentOffset(CGPoint(x: CGFloat(stagePage) * cardStride, y: 0), animated: false)
  }

  @objc private func goBack() {
    if let navigationController, navigationController.viewControllers.count > 1 {
      navigationController.popViewController(animated: true)
      return
    }
    dismiss(animated: true)
    NotificationCenter.default.post(name: .camalertShowTab, object: "settings")
  }
}

extension PremiumViewController: UIScrollViewDelegate {
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard cardStride > 0, slides.count > 0 else { return }
    let page = Int(round(scrollView.contentOffset.x / cardStride))
    stagePage = page
    let index = ((page % slides.count) + slides.count) % slides.count
    for case let dot as UIView in dots.arrangedSubviews {
      let on = dot.tag == index
      dot.backgroundColor = on ? gold : UIColor(white: 1, alpha: 0.35)
      dot.constraints.filter { $0.firstAttribute == .width }.forEach { $0.constant = on ? 18 : 8 }
    }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    settleLoop()
  }

  func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
    settleLoop()
  }
}

private final class ProSlideCard: UIView {
  init(slide: (id: String, title: String, text: String), photo: UIImage?, gold: UIColor, cream: UIColor) {
    super.init(frame: .zero)
    clipsToBounds = true
    layer.cornerRadius = 20
    layer.borderWidth = 1.5
    layer.borderColor = UIColor(red: 255 / 255, green: 217 / 255, blue: 120 / 255, alpha: 1).cgColor
    backgroundColor = UIColor(red: 16 / 255, green: 26 / 255, blue: 58 / 255, alpha: 1)
    let image = UIImageView(image: photo)
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.tag = 41
    addSubview(image)
    let badge = UIView()
    badge.tag = 42
    badge.backgroundColor = UIColor(red: 8 / 255, green: 12 / 255, blue: 32 / 255, alpha: 0.72)
    badge.layer.cornerRadius = 28
    badge.layer.borderWidth = 1.5
    badge.layer.borderColor = gold.cgColor
    let symbol = UIImage.SymbolConfiguration(pointSize: 26, weight: .semibold)
    let icon = UIImageView(image: UIImage(systemName: ProSlideCard.symbolName(slide.id), withConfiguration: symbol))
    icon.tintColor = gold
    icon.contentMode = .scaleAspectFit
    icon.tag = 44
    badge.addSubview(icon)
    addSubview(badge)
    let scrim = UIView()
    scrim.tag = 43
    scrim.backgroundColor = UIColor(red: 8 / 255, green: 12 / 255, blue: 32 / 255, alpha: 0.78)
    addSubview(scrim)
    let title = UILabel()
    title.text = slide.title
    title.textColor = cream
    title.font = .camalert(16, weight: .black)
    title.numberOfLines = 1
    title.adjustsFontSizeToFitWidth = true
    title.minimumScaleFactor = 0.75
    let body = UILabel()
    body.text = slide.text
    body.textColor = cream
    body.font = .camalert(12)
    body.numberOfLines = 2
    body.lineBreakMode = .byWordWrapping
    let copy = UIStackView(arrangedSubviews: [title, body])
    copy.axis = .vertical
    copy.spacing = 2
    copy.translatesAutoresizingMaskIntoConstraints = false
    addSubview(copy)
    NSLayoutConstraint.activate([
      copy.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
      copy.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      copy.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
    ])
  }

  required init?(coder: NSCoder) { nil }

  fileprivate static func symbolName(_ id: String) -> String {
    switch id {
    case "navigation": return "map.fill"
    case "voice": return "speaker.wave.2.fill"
    case "background": return "iphone"
    case "settings": return "slider.horizontal.3"
    default: return "camera.fill"
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    viewWithTag(41)?.frame = bounds
    let side: CGFloat = 56
    let badgeY = max(12, (bounds.height * 0.50 - side) / 2)
    viewWithTag(42)?.frame = CGRect(x: (bounds.width - side) / 2, y: badgeY, width: side, height: side)
    viewWithTag(42)?.viewWithTag(44)?.frame = CGRect(x: 13, y: 13, width: 30, height: 30)
    viewWithTag(43)?.frame = CGRect(x: 0, y: bounds.height * 0.52, width: bounds.width, height: bounds.height * 0.48)
  }
}

private extension UIFont {
  func withWeight(_ weight: UIFont.Weight) -> UIFont {
    let descriptor = fontDescriptor.addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
    return UIFont(descriptor: descriptor, size: pointSize)
  }
}

enum PremiumOffer {
  private static var shownAt = Date.distantPast

  static func present(from viewController: UIViewController) {
    guard !ProcessInfo.processInfo.arguments.contains("--voice-check") else { return }
    guard !ProcessInfo.processInfo.arguments.contains("--premium-check") else { return }
    guard Date().timeIntervalSince(shownAt) > 90 else { return }
    let root = viewController.view.window?.rootViewController ?? viewController
    guard root.presentedViewController == nil else { return }
    shownAt = Date()
    let sheet = PremiumOfferController()
    sheet.modalPresentationStyle = .overFullScreen
    sheet.modalTransitionStyle = .crossDissolve
    root.present(sheet, animated: true)
  }
}

private final class PremiumOfferController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(white: 0, alpha: 0.45)
    let card = UIView()
    card.backgroundColor = UIColor(red: 16 / 255, green: 26 / 255, blue: 58 / 255, alpha: 1)
    card.layer.cornerRadius = 16
    card.translatesAutoresizingMaskIntoConstraints = false
    let title = UILabel()
    title.text = "CamAlert Premium"
    title.textColor = .white
    title.font = .camalert(18, weight: .heavy)
    let message = UILabel()
    message.text = "Голосовая навигация, голосовые предупреждения, работа в фоне и альтернативные маршруты входят в Premium."
    message.textColor = UIColor(red: 213 / 255, green: 217 / 255, blue: 232 / 255, alpha: 1)
    message.font = .camalert(14)
    message.numberOfLines = 0
    let open = UIButton(type: .system)
    open.setTitle("Открыть Premium", for: .normal)
    open.setTitleColor(UIColor(red: 17 / 255, green: 16 / 255, blue: 26 / 255, alpha: 1), for: .normal)
    open.titleLabel?.font = .camalert(16, weight: .bold)
    open.backgroundColor = UIColor(red: 255 / 255, green: 198 / 255, blue: 41 / 255, alpha: 1)
    open.layer.cornerRadius = 14
    open.heightAnchor.constraint(equalToConstant: 44).isActive = true
    open.addAction(UIAction { [weak self] _ in
      let presenter = self?.presentingViewController
      self?.dismiss(animated: true) {
        let screen = PremiumViewController()
        screen.modalPresentationStyle = .fullScreen
        presenter?.present(screen, animated: true)
      }
    }, for: .touchUpInside)
    let later = UIButton(type: .system)
    later.setTitle("Не сейчас", for: .normal)
    later.setTitleColor(.white, for: .normal)
    later.titleLabel?.font = .camalert(15, weight: .semibold)
    later.addAction(UIAction { [weak self] _ in self?.dismiss(animated: true) }, for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [title, message, open, later])
    stack.axis = .vertical
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(stack)
    view.addSubview(card)
    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
    ])
  }
}
