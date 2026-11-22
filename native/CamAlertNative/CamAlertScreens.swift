import StoreKit
import UIKit

final class HomeViewController: UIViewController {
  private let session = CamAlertSession.shared
  private let titleLabel = UILabel()
  private let statusLabel = UILabel()
  private let startButton = UIButton(type: .system)
  private let searchButton = UIButton(type: .system)
  private let countryButton = UIButton(type: .system)
  private let settingsButton = UIButton(type: .system)
  private let premiumButton = UIButton(type: .system)

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.98, alpha: 1)
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Premium", style: .plain, target: self, action: #selector(openPremium))
    titleLabel.text = "Камеры на дорогах"
    titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
    titleLabel.textColor = UIColor(red: 0.06, green: 0.15, blue: 0.23, alpha: 1)
    statusLabel.numberOfLines = 2
    statusLabel.font = .preferredFont(forTextStyle: .subheadline)
    statusLabel.textColor = UIColor(red: 0.14, green: 0.27, blue: 0.36, alpha: 1)
    style(startButton, title: "Начать поездку", filled: true, action: #selector(startTrip))
    style(searchButton, title: "Куда едем", filled: false, action: #selector(openSearch))
    style(countryButton, title: "Страна и база", filled: false, action: #selector(openCountries))
    style(settingsButton, title: "Настройки", filled: false, action: #selector(openSettings))
    style(premiumButton, title: "CamAlert Premium", filled: false, action: #selector(openPremium))
    let stack = UIStackView(arrangedSubviews: [titleLabel, statusLabel, startButton, searchButton, countryButton, settingsButton, premiumButton])
    stack.axis = .vertical
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
      stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
      startButton.heightAnchor.constraint(equalToConstant: 58),
      searchButton.heightAnchor.constraint(equalToConstant: 54),
    ])
    Task { await session.catalog.refreshManifest(); refresh() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    refresh()
  }

  private func refresh() {
    let code = session.settings.country.uppercased()
    let local = session.catalog.cameras(for: code).count
    let total = session.catalog.totalRecords
    let countries = session.catalog.countries.count
    statusLabel.text = total > 0
      ? "База: \(total) объектов в \(countries) странах. Сейчас \(code): \(local)."
      : "Офлайн \(code): \(local) камер. Украина и Польша сохранены в приложении."
  }

  private func style(_ button: UIButton, title: String, filled: Bool, action: Selector) {
    var config = UIButton.Configuration.filled()
    config.title = title
    config.cornerStyle = .large
    config.baseBackgroundColor = filled ? UIColor(red: 0.08, green: 0.35, blue: 0.93, alpha: 1) : .white
    config.baseForegroundColor = filled ? .white : UIColor(red: 0.08, green: 0.35, blue: 0.93, alpha: 1)
    config.background.strokeColor = filled ? nil : UIColor(red: 0.08, green: 0.35, blue: 0.93, alpha: 1)
    config.background.strokeWidth = filled ? 0 : 1.5
    button.configuration = config
    button.addTarget(self, action: action, for: .touchUpInside)
  }

  @objc private func startTrip() { navigationController?.pushViewController(ViewController(), animated: true) }
  @objc private func openSearch() {
    let drive = ViewController()
    drive.openSearchOnAppear = true
    navigationController?.pushViewController(drive, animated: true)
  }
  @objc private func openCountries() { navigationController?.pushViewController(CountriesViewController(), animated: true) }
  @objc private func openSettings() { navigationController?.pushViewController(SettingsViewController(), animated: true) }
  @objc private func openPremium() { navigationController?.pushViewController(PremiumViewController(), animated: true) }
}

final class SettingsViewController: UIViewController {
  private let session = CamAlertSession.shared
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.04, green: 0.09, blue: 0.16, alpha: 1)
    title = "Настройки"
    let voice = switchRow("Голос камер", session.settings.voice) { self.session.settings.voice = $0; self.session.save() }
    let vibration = switchRow("Вибрация", session.settings.vibration) { self.session.settings.vibration = $0; self.session.save() }
    let warnings = switchRow("Предупреждения о камерах", session.settings.cameraWarnings) { self.session.settings.cameraWarnings = $0; self.session.save() }
    let smart = switchRow("Умная дистанция по скорости", session.settings.smartDistance) { self.session.settings.smartDistance = $0; self.session.save() }
    let distances = UILabel()
    distances.numberOfLines = 0
    distances.textColor = UIColor(red: 0.79, green: 0.84, blue: 0.91, alpha: 1)
    distances.text = "До 60 км/ч — 600 м\n60–89 — 900 м\n90–119 — 1200 м\n120+ — 1500 м"
    let help = link("Как пользоваться", "https://camera.21wek.com/")
    let privacy = link("Политика конфиденциальности", "https://camera.21wek.com/privacy.html")
    let stack = UIStackView(arrangedSubviews: [warnings, voice, vibration, smart, distances, help, privacy])
    stack.axis = .vertical
    stack.spacing = 14
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
      stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
    ])
  }

  private func switchRow(_ title: String, _ value: Bool, changed: @escaping (Bool) -> Void) -> UIStackView {
    let label = UILabel()
    label.text = title
    label.textColor = .white
    let toggle = UISwitch()
    toggle.isOn = value
    toggle.addAction(UIAction { _ in changed(toggle.isOn) }, for: .valueChanged)
    let row = UIStackView(arrangedSubviews: [label, toggle])
    row.axis = .horizontal
    return row
  }

  private func link(_ title: String, _ url: String) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.contentHorizontalAlignment = .leading
    button.addAction(UIAction { _ in
      if let url = URL(string: url) { UIApplication.shared.open(url) }
    }, for: .touchUpInside)
    return button
  }
}

final class CountriesViewController: UITableViewController {
  private let session = CamAlertSession.shared
  private var rows: [CountryListing] = []
  override func viewDidLoad() {
    super.viewDidLoad()
    title = "Страны"
    tableView.backgroundColor = UIColor(red: 0.04, green: 0.09, blue: 0.16, alpha: 1)
    rows = session.catalog.countries
    if rows.isEmpty {
      rows = [
        CountryListing(code: "UA", name: "Ukraine", recordCount: session.catalog.cameras(for: "UA").count, version: nil, path: nil, sizeBytes: nil, checksum: nil),
        CountryListing(code: "PL", name: "Poland", recordCount: session.catalog.cameras(for: "PL").count, version: nil, path: nil, sizeBytes: nil, checksum: nil),
      ]
    }
  }
  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows.count }
  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
    let row = rows[indexPath.row]
    let selected = row.code == session.settings.country.uppercased()
    cell.textLabel?.text = "\(row.name)\(selected ? " · выбрана" : "")"
    cell.detailTextLabel?.text = "\(row.recordCount)"
    cell.backgroundColor = UIColor(red: 0.09, green: 0.16, blue: 0.25, alpha: 1)
    cell.textLabel?.textColor = .white
    cell.detailTextLabel?.textColor = UIColor(red: 0.79, green: 0.84, blue: 0.91, alpha: 1)
    return cell
  }
  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let code = rows[indexPath.row].code
    session.settings.country = code
    session.save()
    Task {
      let error = await session.catalog.ensureCountry(code)
      await MainActor.run {
        self.navigationItem.prompt = error
        self.tableView.reloadData()
      }
    }
  }
}

final class PremiumViewController: UIViewController {
  private var products: [Product] = []
  private let status = UILabel()
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.09, green: 0.04, blue: 0.14, alpha: 1)
    title = "Premium"
    status.numberOfLines = 0
    status.textColor = .white
    status.text = PremiumAccess.enforcement
      ? "Нужна действующая подписка."
      : "В опубликованной версии навигация и предупреждения открыты. Покупки ниже сохраняют существующие продукты StoreKit."
    let restore = UIButton(type: .system)
    restore.setTitle("Восстановить покупки", for: .normal)
    restore.addTarget(self, action: #selector(restorePurchases), for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [status, restore])
    stack.axis = .vertical
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
      stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
    ])
    Task { await loadProducts(into: stack) }
  }

  private func loadProducts(into stack: UIStackView) async {
    do {
      products = try await Product.products(for: PremiumAccess.plans)
      await MainActor.run {
        for product in products {
          let button = UIButton(type: .system)
          button.setTitle("\(product.displayName) · \(product.displayPrice)", for: .normal)
          button.addAction(UIAction { [weak self] _ in self?.buy(product) }, for: .touchUpInside)
          stack.addArrangedSubview(button)
        }
        if products.isEmpty { self.status.text = (self.status.text ?? "") + "\nПродукты StoreKit пока не пришли из App Store." }
      }
    } catch {
      await MainActor.run { self.status.text = (self.status.text ?? "") + "\nStoreKit недоступен в этой установке." }
    }
  }

  private func buy(_ product: Product) {
    Task {
      do {
        let result = try await product.purchase()
        if case .success(let verification) = result, case .verified = verification {
          await MainActor.run { self.status.text = "Покупка сохранена: \(product.id)" }
        }
      } catch {
        await MainActor.run { self.status.text = "Покупка не завершилась" }
      }
    }
  }

  @objc private func restorePurchases() {
    Task {
      try? await AppStore.sync()
      await MainActor.run { self.status.text = "Запрос восстановления отправлен в App Store." }
    }
  }
}

enum CarPlaySupport {
  // The published app keeps background location. A CarPlay scene is reserved
  // here and is not presented until that capability is part of the shipping app.
  static let backgroundLocationReady = true
}
