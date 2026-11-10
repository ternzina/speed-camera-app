import CoreLocation
import ExpoModulesCore
import MapKit

public class CamAlertMapKitDirectionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CamAlertMapKitDirections")

    AsyncFunction("searchPlaces") { (query: String, latitude: Double, longitude: Double, hasBias: Bool) async throws -> [[String: Any]] in
      let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmed.isEmpty {
        throw Exception(name: "EmptyQuery", description: "Enter an address.", code: "EmptyQuery")
      }
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = trimmed
      request.resultTypes = [.address, .pointOfInterest]
      let bias = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
      if hasBias && CLLocationCoordinate2DIsValid(bias) {
        request.region = MKCoordinateRegion(center: bias, span: MKCoordinateSpan(latitudeDelta: 0.45, longitudeDelta: 0.45))
      }
      let response = try await MKLocalSearch(request: request).start()
      return response.mapItems.compactMap { item in
        let coordinate = item.placemark.coordinate
        guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }
        return [
          "title": item.name ?? item.placemark.name ?? "",
          "subtitle": Self.subtitle(for: item.placemark),
          "latitude": coordinate.latitude,
          "longitude": coordinate.longitude,
        ]
      }
    }

    AsyncFunction("calculateRoutes") { (originLatitude: Double, originLongitude: Double, destinationLatitude: Double, destinationLongitude: Double) async throws -> [[String: Any]] in
      let origin = CLLocationCoordinate2D(latitude: originLatitude, longitude: originLongitude)
      let destination = CLLocationCoordinate2D(latitude: destinationLatitude, longitude: destinationLongitude)
      guard CLLocationCoordinate2DIsValid(origin), CLLocationCoordinate2DIsValid(destination) else {
        throw Exception(name: "InvalidCoordinate", description: "Origin and destination coordinates are required.", code: "InvalidCoordinate")
      }
      let request = MKDirections.Request()
      request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin))
      request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
      request.transportType = .automobile
      request.requestsAlternateRoutes = true
      let response = try await MKDirections(request: request).calculate()
      return response.routes.map { route in
        [
          "name": route.name,
          "distance": route.distance,
          "expectedTravelTime": route.expectedTravelTime,
          "advisoryNotices": route.advisoryNotices,
          "polyline": Self.coordinates(of: route.polyline),
          "steps": route.steps.map { step in
            [
              "instructions": step.instructions,
              "notice": step.notice ?? "",
              "distance": step.distance,
              "polyline": Self.coordinates(of: step.polyline),
            ]
          },
        ]
      }
    }
  }

  private static func subtitle(for placemark: MKPlacemark) -> String {
    [placemark.subThoroughfare, placemark.thoroughfare, placemark.locality, placemark.administrativeArea, placemark.country]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
      .joined(separator: ", ")
  }

  private static func coordinates(of polyline: MKPolyline) -> [[String: Double]] {
    let count = polyline.pointCount
    if count == 0 { return [] }
    var coordinates = Array(repeating: CLLocationCoordinate2D(), count: count)
    polyline.getCoordinates(&coordinates, range: NSRange(location: 0, length: count))
    return coordinates.compactMap { coordinate in
      guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }
      return ["latitude": coordinate.latitude, "longitude": coordinate.longitude]
    }
  }
}
