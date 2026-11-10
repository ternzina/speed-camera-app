Pod::Spec.new do |s|
  s.name           = 'CamAlertMapKitDirections'
  s.version        = '1.0.0'
  s.summary        = 'MKLocalSearch and MKDirections for CamAlert'
  s.description    = 'Native Apple MapKit search and driving routes. Results come only from MapKit.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'CamAlert'
  s.homepage       = 'https://camera.21wek.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true
  s.frameworks     = 'MapKit', 'CoreLocation'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
