{
  id: 'taxonomy_tree',
  label: 'Taxonomy Tree',
  options: {
    color_with_children: {
      label: "Node Color With Children",
      default: "#36c1b3",
      type: "string",
      display: "color"
    },
    color_empty: {
      label: "Empty Node Color", 
      default: "#fff",
      type: "string",
      display: "color"
    },
    node_size: {
      label: "Node Size",
      default: 4,
      type: "number"
    },
    tree_height: {
      label: "Tree Height",
      default: 600,
      type: "number"
    }
  },

  create: function(element, config) {
    // Load D3 if not available
    if (!window.d3) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
      script.onload = () => {
        this.svg = d3.select(element).append("svg");
      };
      document.head.appendChild(script);
    } else {
      this.svg = d3.select(element).append("svg");
    }
  },

  update: function(data, element, config, queryResponse) {
    if (!window.d3) {
      element.innerHTML = '<div style="padding: 20px;">Loading D3...</div>';
      return;
    }

    try {
      // Clear previous content
      this.svg.selectAll("*").remove();
      
      // Transform Looker data to hierarchical structure
      const hierarchicalData = this.transformDataToHierarchy(data);
      
      // Render the tree
      this.renderTree(hierarchicalData, config, element);
      
    } catch (error) {
      console.error('Taxonomy Tree Error:', error);
      element.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
    }
  },

  transformDataToHierarchy: function(data) {
    if (!data || data.length === 0) {
      throw new Error('No data provided');
    }

    const nested = {};
    
    // Build nested structure
    data.forEach(row => {
      const l0 = row['local_mi_base_rank.l0'] && row['local_mi_base_rank.l0'].value;
      const l1 = row['local_mi_base_rank.l1'] && row['local_mi_base_rank.l1'].value;
      const l2 = row['local_mi_base_rank.l2'] && row['local_mi_base_rank.l2'].value;
      const l3 = row['local_mi_base_rank.l3'] && row['local_mi_base_rank.l3'].value;
      const searchVolume = row['local_mi_base_rank.global_monthly_search'] && row['local_mi_base_rank.global_monthly_search'].value || 0;

      if (!l0) return;

      // Initialize nested structure
      if (!nested[l0]) nested[l0] = { __data: { searchVolume: 0, count: 0 } };
      nested[l0].__data.searchVolume += searchVolume;
      nested[l0].__data.count++;

      if (l1) {
        if (!nested[l0][l1]) nested[l0][l1] = { __data: { searchVolume: 0, count: 0 } };
        nested[l0][l1].__data.searchVolume += searchVolume;
        nested[l0][l1].__data.count++;

        if (l2) {
          if (!nested[l0][l1][l2]) nested[l0][l1][l2] = { __data: { searchVolume: 0, count: 0 } };
          nested[l0][l1][l2].__data.searchVolume += searchVolume;
          nested[l0][l1][l2].__data.count++;

          if (l3) {
            if (!nested[l0][l1][l2][l3]) nested[l0][l1][l2][l3] = { __data: { searchVolume: 0, count: 0 } };
            nested[l0][l1][l2][l3].__data.searchVolume += searchVolume;
            nested[l0][l1][l2][l3].__data.count++;
          }
        }
      }
    });

    // Convert to D3 hierarchy format
    function buildHierarchy(obj, name = 'root', depth = 0) {
      const children = [];
      
      for (const key in obj) {
        if (key !== '__data') {
          children.push(buildHierarchy(obj[key], key, depth + 1));
        }
      }

      const node = {
        name: name,
        depth: depth,
        data: obj.__data || { searchVolume: 0, count: 0 }
      };

      if (children.length > 0) {
        node.children = children;
      }

      return node;
    }

    return buildHierarchy(nested);
  },

  renderTree: function(data, config, element) {
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = (config.tree_height || 600) - margin.top - margin.bottom;

    this.svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = this.svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create tree layout - horizontal orientation
    const tree = d3.tree().size([height, width]);
    
    // Create hierarchy
    const root = d3.hierarchy(data);
    root.x0 = height / 2;
    root.y0 = 0;

    // Keep all nodes expanded by default (no collapsing initially)
    
    this.update(root);

    const self = this;
    let i = 0;
    
    function update(source) {
      // Compute the new tree layout
      const treeData = tree(root);
      const nodes = treeData.descendants();
      const links = treeData.descendants().slice(1);

      // Normalize for fixed-depth - horizontal layout
      nodes.forEach(d => { d.y = d.depth * 180; });

      // Update the nodes
      const node = g.selectAll("g.node")
        .data(nodes, d => d.id || (d.id = ++i));

      // Enter any new nodes at the parent's previous position
      const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.y0},${source.x0})`)
        .on("click", click);

      // Add Circle for the nodes
      nodeEnter.append("circle")
        .attr("class", "node")
        .attr("r", 1e-6)
        .style("fill", d => d._children ? (config.color_with_children || "#36c1b3") : (config.color_empty || "#fff"))
        .style("stroke", config.color_with_children || "#36c1b3")
        .style("stroke-width", "2px")
        .style("cursor", "pointer");

      // Add labels for the nodes
      nodeEnter.append("text")
        .attr("dy", ".35em")
        .attr("x", d => d.children || d._children ? -13 : 13)
        .attr("text-anchor", d => d.children || d._children ? "end" : "start")
        .style("font-family", "'Open Sans', Helvetica, sans-serif")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text(d => {
          const volume = d.data.data ? d.data.data.searchVolume : 0;
          const formattedVolume = volume >= 1000000 ? 
            (volume / 1000000).toFixed(1) + 'M' :
            volume >= 1000 ? 
            (volume / 1000).toFixed(0) + 'K' :
            volume.toString();
          
          return `${d.data.name} (${formattedVolume})`;
        });

      // UPDATE
      const nodeUpdate = nodeEnter.merge(node);

      // Transition to the proper position for the node
      nodeUpdate.transition()
        .duration(750)
        .attr("transform", d => `translate(${d.y},${d.x})`);

      // Update the node attributes and style
      nodeUpdate.select("circle.node")
        .attr("r", config.node_size || 4)
        .style("fill", d => d._children ? (config.color_with_children || "#36c1b3") : (config.color_empty || "#fff"))
        .attr("cursor", "pointer");

      // Remove any exiting nodes
      const nodeExit = node.exit().transition()
        .duration(750)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();

      // On exit reduce the node circles size to 0
      nodeExit.select("circle")
        .attr("r", 1e-6);

      // On exit reduce the opacity of text labels
      nodeExit.select("text")
        .style("fill-opacity", 1e-6);

      // Update the links
      const link = g.selectAll("path.link")
        .data(links, d => d.id);

      // Enter any new links at the parent's previous position
      const linkEnter = link.enter().insert("path", "g")
        .attr("class", "link")
        .style("fill", "none")
        .style("stroke", "#ddd")
        .style("stroke-width", "2px")
        .attr("d", d => {
          const o = {x: source.x0, y: source.y0};
          return diagonal(o, o);
        });

      // UPDATE
      const linkUpdate = linkEnter.merge(link);

      // Transition back to the parent element position
      linkUpdate.transition()
        .duration(750)
        .attr("d", d => diagonal(d, d.parent));

      // Remove any exiting links
      link.exit().transition()
        .duration(750)
        .attr("d", d => {
          const o = {x: source.x, y: source.y};
          return diagonal(o, o);
        })
        .remove();

      // Store the old positions for transition
      nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });

      // Creates a curved (diagonal) path from parent to the child nodes
      function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
      }

      // Toggle children on click
      function click(event, d) {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          d.children = d._children;
          d._children = null;
        }
        update(d);
      }
    }

    this.update = update;
  }
}
