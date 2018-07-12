/**
 * @module olgm/herald/Feature
 */
import {inherits} from 'ol/index.js';
import Observable from 'ol/Observable.js';
import Icon from 'ol/style/Icon.js';
import {getCenterOf, getStyleOf} from '../util.js';
import {assert} from '../asserts.js';
import {createFeature, createStyle, createLatLng, createMapIcon,
  createLabel, createFeatureGeometry} from '../gm.js';
import Herald from './Herald.js';

/**
 * The Feature Herald is responsible of synchronizing a single ol3 vector
 * feature to a gmap feature. Here's what synchronized within the feature:
 *
 * - its geometry
 * - its style
 *
 * @param {!ol.Map} ol3map openlayers map
 * @param {!google.maps.Map} gmap google maps map
 * @param {olgmx.herald.FeatureOptions} options options
 * @constructor
 * @extends {olgm.herald.Herald}
 */
const Feature = function(ol3map, gmap, options) {

  /**
   * @type {ol.Feature}
   * @private
   */
  this.feature_ = options.feature;

  /**
   * @type {!google.maps.Data}
   * @private
   */
  this.data_ = options.data;

  /**
   * @type {number}
   * @private
   */
  this.index_ = options.index;

  /**
   * @type {olgmx.gm.MapIconOptions}
   * @private
   */
  this.mapIconOptions_ = options.mapIconOptions;

  /**
   * @type {boolean}
   * @private
   */
  this.visible_ = options.visible !== undefined ? options.visible : true;

  Herald.call(this, ol3map, gmap);

};

inherits(Feature, Herald);


/**
 * @type {google.maps.Data.Feature}
 * @private
 */
Feature.prototype.gmapFeature_ = null;


/**
 * @type {olgm.gm.MapLabel}
 * @private
 */
Feature.prototype.label_ = null;

/**
 * The marker object contains a marker to draw on a canvas instead of using
 * the Google Maps API. If useCanvas_ is set to false, this variable won't
 * be used.
 * @type {olgm.gm.MapIcon}
 * @private
 */
Feature.prototype.marker_ = null;


/**
 * @inheritDoc
 */
Feature.prototype.activate = function() {

  Herald.prototype.activate.call(this);

  const geometry = this.getGeometry_();

  // create gmap feature
  this.gmapFeature_ = createFeature(this.feature_);

  if (this.visible_) {
    this.data_.add(this.gmapFeature_);
  }

  // override style if a style is defined at the feature level
  const gmStyle = createStyle(
    this.feature_, this.mapIconOptions_, this.index_);
  if (gmStyle) {
    this.data_.overrideStyle(this.gmapFeature_, gmStyle);
  }

  // if the feature has text style, add a map label to gmap
  const latLng = createLatLng(getCenterOf(geometry));
  const style = getStyleOf(this.feature_);

  if (style) {
    const zIndex = style.getZIndex();
    const index = zIndex !== undefined ? zIndex : this.index_;

    const image = style.getImage();
    const useCanvas = this.mapIconOptions_.useCanvas !== undefined ?
      this.mapIconOptions_.useCanvas : false;
    if (image && image instanceof Icon && useCanvas) {
      this.marker_ = createMapIcon(image, latLng, index);
      if (this.visible_) {
        this.marker_.setMap(this.gmap);
      }
    }

    const text = style.getText();
    if (text) {
      this.label_ = createLabel(text, latLng, index);
      if (this.visible_) {
        this.label_.setMap(this.gmap);
      }
    }
  }

  // event listeners (todo)
  const keys = this.listenerKeys;
  this.geometryChangeKey_ = geometry.on(
    'change', this.handleGeometryChange_, this);
  keys.push(this.geometryChangeKey_);
  keys.push(this.feature_.on(
    'change:' + this.feature_.getGeometryName(),
    this.handleGeometryReplace_, this
  ));
};


/**
 * @inheritDoc
 */
Feature.prototype.deactivate = function() {

  // remove gmap feature
  this.data_.remove(this.gmapFeature_);
  this.gmapFeature_ = null;

  // remove feature
  if (this.marker_) {
    this.marker_.setMap(null);
    this.marker_ = null;
  }

  // remove label
  if (this.label_) {
    this.label_.setMap(null);
    this.label_ = null;
  }

  Herald.prototype.deactivate.call(this);
};


/**
 * Set visible or invisible, without deleting the feature object
 * @param {boolean} value true to set visible, false to set invisible
 */
Feature.prototype.setVisible = function(value) {
  if (value && !this.visible_) {
    this.data_.add(this.gmapFeature_);

    if (this.marker_) {
      this.marker_.setMap(this.gmap);
    }

    if (this.label_) {
      this.label_.setMap(this.gmap);
    }

    this.visible_ = true;
  } else if (!value && this.visible_) {

    this.data_.remove(this.gmapFeature_);

    if (this.marker_) {
      this.marker_.setMap(null);
    }

    if (this.label_) {
      this.label_.setMap(null);
    }

    this.visible_ = false;
  }
};

/**
 * @private
 * @return {ol.geom.Geometry} the feature's geometry
 */
Feature.prototype.getGeometry_ = function() {
  const geometry = this.feature_.getGeometry();
  assert(
    geometry !== undefined, 'Expected feature to have geometry');
  return /** @type {ol.geom.Geometry} */ (geometry);
};


/**
 * @private
 */
Feature.prototype.handleGeometryChange_ = function() {
  const geometry = this.getGeometry_();
  this.gmapFeature_.setGeometry(createFeatureGeometry(geometry));

  let latLng;

  if (this.label_) {
    latLng = createLatLng(getCenterOf(geometry));
    this.label_.set('position', latLng);
  }

  if (this.marker_) {
    latLng = createLatLng(getCenterOf(geometry));
    this.marker_.set('position', latLng);
  }
};


/**
 * @private
 */
Feature.prototype.handleGeometryReplace_ = function() {
  const keys = this.listenerKeys;
  Observable.unByKey(this.geometryChangeKey_);
  const index = keys.indexOf(this.geometryChangeKey_);
  keys.splice(index, 1);

  this.geometryChangeKey_ = this.feature_.getGeometry().on('change',
    this.handleGeometryChange_,
    this);
  keys.push(this.geometryChangeKey_);
  this.handleGeometryChange_();
};
export default Feature;
