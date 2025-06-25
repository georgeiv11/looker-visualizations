looker.plugins.visualizations.add({
  id: 'taxonomy_tree',
  label: 'Taxonomy Tree',
  options: {
    tree_height: {
      type: 'number',
      label: 'Height (px)',
      default: 600,
      section: 'Style'
    }
  },

  create: function(element, config) {
    element.innerHTML = `<div id="tree-container" style="width: 100%; height: ${config.tree_height || 600}px;"><div id="loading">Loading...</div></div>`;
    if (!window.Highcharts) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.2.0/highcharts.min.js';
      script.onload = () => {
        const treegraphScript = document.createElement('script');
        treegraphScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.2.0/modules/treegraph.min.js';
        document.head.appendChild(treegraphScript);
      };
      document.head.appendChild(script);
    }
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    document.getElementById('loading').style.display = 'none';
    const treeData = this.transformDataToTree(data);
    this.createTreeVisualization(treeData, config);
    done();
  },

  transformDataToTree: function(data) {
    const nodes = new Set();
    const relationships = [];
    const searchVolumeMap = new Map();
    
    data.forEach(row => {
      const l0 = row['local_mi_base_rank.l0']?.value;
      const l1 = row['local_mi_base_rank.l1']?.value;
      const l2 = row['local_mi_base_rank.l2']?.value;
      const l3 = row['local_mi_base_rank.l3']?.value;
      const searchVolume = row['local_mi_base_rank.global_monthly_search']?.value || 0;
      
      if (l0) {
        nodes.add(l0);
        searchVolumeMap.set(l0, (searchVolumeMap.get(l0) || 0) + searchVolume);
      }
      if (l1) {
        nodes.add(l1);
        searchVolumeMap.set(l1, (searchVolumeMap.get(l1) || 0) + searchVolume);
        if (l0) relationships.push([l0, l1]);
      }
      if (l2) {
        nodes.add(l2);
        searchVolumeMap.set(l2, (searchVolumeMap.get(l2) || 0) + searchVolume);
        if (l1) relationships.push([l1, l2]);
      }
      if (l3) {
        nodes.add(l3);
        searchVolumeMap.set(l3, (searchVolumeMap.get(l3) || 0) + searchVolume);
        if (l2) relationships.push([l2, l3]);
      }
    });

    const treeData = [];
    const l0Nodes = Array.from(nodes).filter(node => 
      !relationships.some(rel => rel[1] === node)
    );
    l0Nodes.forEach(l0 => {
      treeData.push([undefined, l0]);
    });
    relationships.forEach(rel => {
      treeData.push(rel);
    });
    
    treeData.searchVolumeMap = searchVolumeMap;
    return treeData;
  },

  createTreeVisualization: function(treeData, config) {
    const container = document.getElementById('tree-container');
    
    Highcharts.chart(container, {
      chart: {
        spacingBottom: 30,
        marginRight: 150,
        height: config.tree_height || 600
      },
      title: {
        text: 'Taxonomy Tree'
      },
      series: [{
        type: 'treegraph',
        keys: ['parent', 'id', 'level'],
        clip: false,
        data: treeData,
        marker: {
          symbol: 'circle',
          radius: 6,
          fillColor: '#ffffff',
          lineWidth: 2
        },
        dataLabels: {
          align: 'left',
          pointFormat: '{point.id}',
          style: {
            color: '#000',
            textOutline: '2px contrast',
            whiteSpace: 'nowrap'
          },
          x: 15,
          crop: false,
          overflow: 'allow'
        },
        levels: [
          {
            level: 1,
            levelIsConstant: false
          },
          {
            level: 2,
            colorByPoint: true
          },
          {
            level: 3,
            colorVariation: {
              key: 'brightness',
              to: -0.3
            }
          },
          {
            level: 4,
            colorVariation: {
              key: 'brightness',
              to: 0.3
            }
          }
        ]
      }]
    });
  }
});
