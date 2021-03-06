// core modules
import React, { Component,
                PropTypes }   from 'react';
import ReactDOM               from 'react-dom';
import google                 from 'google';

import Marker                 from './Marker';


export class GoogleMap extends Component {
  static propTypes = {
    center:               PropTypes.shape({
      lat: PropTypes.number,
      lng: PropTypes.number
    }),
    centerChanged:        PropTypes.func,
    containerStyle:       PropTypes.object,
    directionMarkers:     PropTypes.shape({
      origin:       PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.instanceOf(Marker)
      ]),
      destination:  PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.instanceOf(Marker)
      ]),
      waypoints:    PropTypes.arrayOf(PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.instanceOf(Marker)
      ]))
    }),
    mapOptions:           PropTypes.object,
    markers:              PropTypes.arrayOf(PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.instanceOf(Marker)
    ])),
    subscribePanTo:       PropTypes.func,
    unsubscribePanTo:     PropTypes.func,
    zoom:                 PropTypes.number,
    zoomChanged:          PropTypes.func,
    showDirections:       PropTypes.bool,
    showTraffic:          PropTypes.bool
  };

  static defaultProps = {
    centerChanged:         () => {},
    containerStyle: {
      width:  '100%',
      height: '100%'
    },
    directionsMarkers: {
      origin: null,
      destination: null,
      waypoints: []
    },
    mapOptions: {
      center: {
        lat:    30.3074625,
        lng:    -98.0335911
      },
      mapTypeControl: false,
      streetViewControl: false,
      zoom:     10
    },
    markers:  [],
    subscribePanTo: () => {},
    unsubscribePanTo: () => {},
    showDirections:   false,
    showTraffic: false,
    zoomChanged: () => {}
  };

  _directionsService    = null;
  _map                  = null;
  _trafficLayer         = null;
  _mapMarkers           = {};
  _directionsData       = [];

  constructor(props) {
    super(props);

    if (!google || !google.maps) {
      throw 'Can\'t find Google Maps API';
    }

    this._directionsService = new google.maps.DirectionsService();
    this._trafficLayer      = new google.maps.TrafficLayer();
  }

  mapOptions() {
    const { center, mapOptions, zoom } = this.props;

    if (center) {
      mapOptions.center = center;
    }
    if (zoom) {
      mapOptions.zoom = zoom;
    }

    return mapOptions;
  }

  showMarkers() {
    this.clearMarkers();
    const map = this._map;
    this._mapMarkers = this.props.markers.reduce(function (reduction, marker) {
      if (Number.isFinite(marker.position.lat) && Number.isFinite(marker.position.lng)) {
        reduction[marker.id] = new google.maps.Marker({
          label:      marker.label,
          map:        map,
          position:   marker.position,
          title:      marker.title,
          animation:  google.maps.Animation.DROP
        });

        if (marker.icon) {
          reduction[marker.id].setIcon(marker.icon);
        }

        if (marker.click && (typeof marker.click === 'function')) {
          reduction[marker.id].addListener('click', marker.onClick);
        }
      }

      return reduction;
    }, {});
  }

  clearMarkers() {
    const markerKeys = Object.keys(this._mapMarkers);
    const mapMarkers = this._mapMarkers;
    markerKeys.forEach(function (markerKey) {
      mapMarkers[markerKey].setMap(null);
      google.maps.event.clearInstanceListeners(mapMarkers[markerKey]);
      delete mapMarkers[markerKey];
    });
  }

  showTraffic() {
    this._trafficLayer.setMap(this._map);
  }

  hideTraffic() {
    this._trafficLayer.setMap(null);
  }

  _setDirectionsData = (directionsPolylines) => {
    this._directionsData =       directionsPolylines;
  }

  showDirections() {
    const { origin, destination, waypoints } = this.props.directionsMarkers;
    const _setDirectionsData = this._setDirectionsData;
    const map = this._map;

    this._directionsService.route({
        origin: origin.position,
        destination: destination.position,
        waypoints: waypoints.map(waypoint => {
          return {location: waypoint.position, stopover: true};
        }),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true
      },
      function (result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
          var directionsData = result.routes[0].legs.map(function (leg) {
            var polyline = new google.maps.Polyline({
              path: [],
              strokeColor: 'blue',
              strokeWeight: 10,
              strokeOpacity: 0.5
            });
            var infoWindow = new google.maps.InfoWindow({
              content: `${leg.distance.text}<br/>${leg.duration.text}`
            });
            polyline.addListener('mouseover',
                function directionsRouteMouseoverEventHandler(e) {
                  this.setOptions({
                    strokeColor: 'red',
                    strokeOpacity: 0.5,
                    strokeWeight: 10
                  });
                  infoWindow.setPosition(e.latLng);
                  infoWindow.open(map);
                }
            );
            polyline.addListener('mouseout',
                function directionsRouteMouseoutEventHandler() {
                  this.setOptions({
                    strokeColor: 'blue',
                    strokeWeight: 10,
                    strokeOpacity: 0.5
                  });
                  infoWindow.close();
                }
            );
            const steps = leg.steps;
            steps.forEach(function (step) {
              step.path.forEach(function (latLng) {
                polyline.getPath().push(latLng);
              });
            });
            return {
              infoWindow,
              polyline
            };
          });
          directionsData.forEach(function (leg) {
            leg.polyline.setMap(map);
          });
          _setDirectionsData(directionsData);
        }
      }
    );
  }

  hideDirections() {
    this._directionsData.forEach(function (leg) {
      leg.polyline.setMap(null);
      google.maps.event.clearInstanceListeners(leg);
      leg.infoWindow.close();
    });
    this._directionsData = [];
  }

  initializeMap() {
    const { showDirections, showTraffic, centerChanged, zoomChanged } = this.props;
    // create a new google map
    this._map = new google.maps.Map(ReactDOM.findDOMNode(this), this.mapOptions());

    const map = this._map;

    this._map.addListener('center_changed', () => {
      const center = map.getCenter();
      centerChanged({ lat: center.lat(), lng: center.lng() });
    });
    this._map.addListener('zoom_changed', () => { zoomChanged(map.getZoom()); });

    this.showMarkers();

    // show traffic layer if props say so
    if (showTraffic) {
      this.showTraffic();
    }

    if (showDirections) {
      this.showDirections();
    }

    this.props.subscribePanTo(this.panTo);
  }

  updateMap(prevProps) {
    const { showDirections, showTraffic } = this.props;

    this._map.setOptions(this.mapOptions());
    this.showMarkers();

    if (showTraffic && !prevProps.showTraffic) {
      this.showTraffic();
    }
    else if (!showTraffic && prevProps.showTraffic) {
      this.hideTraffic();
    }

    if (showDirections && !prevProps.showDirections) {
      this.showDirections();
    }
    else if (!showDirections && prevProps.showDirections) {
      this.hideDirections();
    }
  }

  panTo = (msg, latLng) => {
    if (Number.isFinite(latLng.lat) && Number.isFinite(latLng.lng)) {
      this._map.panTo(latLng);
    }
  }

  componentDidMount() {
    this.initializeMap();
  }

  componentDidUpdate(prevProps, prevState) {
    this.updateMap(prevProps);
  }

  componentWillUnmount() {
    this.props.unsubscribePanTo(this.panTo);
  }

  render() {
    const { containerStyle } = this.props;

    return (
      <div style={containerStyle}>Map</div>
    );
  }

}
