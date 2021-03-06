define([
        "dojo/_base/declare",
        "underscore",
        "./util",
        "./LayerNode"
    ],
    function(declare,
             _,
             util,
             LayerNode) {
        "use strict";

        var Tree = declare(null, {
            constructor: function(layers) {
                this.layers = layers;
            },

            // Return new tree with state changes applied.
            update: function(state) {
                var layers = _.map(this.layers, function(layer) {
                    return this.coalesceLayerNode(state, null, layer);
                }, this);
                return new Tree(layers);
            },

            // Combine layer node with state and map service data.
            coalesceLayerNode: function(state, parent, layer) {
                var service = layer.getService(),
                    serviceLayer = service.findServiceLayer(layer),
                    layerDetails = service.getLayerDetails(serviceLayer),
                    layerData = _.assign({}, serviceLayer || {}, layerDetails || {}, layer.getData()),
                    layerId = this.createLayerId(parent, layerData),
                    opacity = state.getLayerOpacity(layerId),
                    node = _.assign(layerData, {
                        isSelected: state.isSelected(layerId),
                        isExpanded: state.isExpanded(layerId),
                        infoIsDisplayed: state.infoIsDisplayed(layerId),
                        opacity: _.isNumber(opacity) ? opacity : layer.getOpacity()
                    }),
                    result = new LayerNode(node, parent);

                // Include layers loaded on-demand (overrides layers defined in layers.json).
                if (layer.includeAllLayers() && serviceLayer && serviceLayer.subLayerIds) {
                    _.each(serviceLayer.subLayerIds, function(subLayerId) {
                        var childLayer = this.coalesceSubLayer(state, result, subLayerId);
                        result.addChild(childLayer);
                    }, this);
                } else {
                    _.each(layer.getChildren(), function(child) {
                        var childLayer = this.coalesceLayerNode(state, result, child);
                        result.addChild(childLayer);
                    }, this);
                }

                return result;
            },

            // Wrap service data in layer node objects.
            coalesceSubLayer: function(state, parent, subLayerId) {
                var service = parent.getService(),
                    serviceLayer = service.findServiceLayerById(subLayerId),
                    layerDetails = service.getLayerDetails(serviceLayer),
                    layerData = _.assign({}, serviceLayer || {}, layerDetails || {}),
                    layerId = this.createLayerId(parent, layerData),
                    node = _.assign(layerData, {
                        // Set `includeAllLayers` to true for dynamically
                        // loaded service nodes that contain subLayers.
                        // Otherwise, the tree will render group/folder
                        // layers as leaf nodes, and child layers will
                        // be ignored.
                        includeAllLayers: !!serviceLayer.subLayerIds,
                        isSelected: state.isSelected(layerId),
                        isExpanded: state.isExpanded(layerId),
                        infoIsDisplayed: state.infoIsDisplayed(layerId),
                        opacity: state.getLayerOpacity(layerId)
                    }),
                    result = new LayerNode(node, parent);

                if (serviceLayer.subLayerIds) {
                    _.each(serviceLayer.subLayerIds, function(subLayerId) {
                        var childLayer = this.coalesceSubLayer(state, result, subLayerId);
                        result.addChild(childLayer);
                    }, this);
                }

                return result;
            },

            // `node` should contain the minimum amount of information needed
            // to generate a unique layer ID (name & optionally displayName).
            createLayerId: function(parent, layerData) {
                return LayerNode.prototype.id.call({
                    parent: parent,
                    node: layerData
                });
            },

            // Return new tree filtered by region.
            filterByRegion: function(currentRegion) {
                function filterLayer(layer) {
                    if (!layer.isAvailableInRegion(currentRegion)) {
                        // If we ever reach a node that is not available in
                        // `currentRegion` do not include it or any of its
                        // children in the result.
                        return null;
                    } else if (layer.isFolder()) {
                        // Include folder nodes in result if at least 1 child passed the filter.
                        var parent = new LayerNode(layer.node, layer.parent),
                            children = _.filter(_.map(layer.getChildren(), filterLayer));
                        parent.addChildren(children);
                        return parent.getChildren().length > 0 ? parent : null;

                    }
                    return layer;
                }
                return new Tree(_.filter(_.map(this.layers, filterLayer)));
            },

            // Return new tree filtered by layer name.
            filterByName: function(filterText) {
                if (filterText.length === 0) {
                    return this;
                }

                filterText = filterText.toLowerCase();

                function filterLayer(layer) {
                    if (!layer.isFolder()) {
                        // Include leaf nodes in the result if they pass the filter.
                        var match = layer.getDisplayName().toLowerCase().indexOf(filterText) !== -1;
                        return match ? layer : null;
                    } else {
                        // Include folder nodes in result if at least 1 child passed the filter.
                        var parent = new LayerNode(layer.node, layer.parent),
                            children = _.filter(_.map(layer.getChildren(), filterLayer));
                        parent.addChildren(children);
                        return parent.getChildren().length > 0 ? parent : null;
                    }
                }

                return new Tree(_.filter(_.map(this.layers, filterLayer)));
            },

            getChildren: function() {
                return this.layers;
            },

            // Return flat list of selected layers (leaf nodes only).
            getSelectedLeafNodes: function() {
                var result = [];
                this.walk(function(layer) {
                    if (!layer.isFolder() && layer.isSelected()) {
                        result.push(layer);
                    }
                });
                return result;
            },

            findLayer: function(layerId) {
                return util.find(this.layers, function(layer) {
                    return layer.findLayer(layerId);
                });
            },

            findLayers: function(layerIds) {
                return _.filter(_.map(layerIds, this.findLayer, this));
            },

            walk: function(callback) {
                _.invoke(this.layers, 'walk', callback);
            }
        });

        return Tree;
    }
);
