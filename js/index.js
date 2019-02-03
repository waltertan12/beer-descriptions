(async () => {
    const getBeerDescriptions = async () => {
        const data = await fetch('beer-descriptions.json');
        return await data.json();
    };
    const beerDescriptions = await getBeerDescriptions();
    const descriptionMap = {};
    const descriptionTree = {};

    const makeDescription = beerDescription => ({
        name: beerDescription.name,
        parents: {},
        children: {},
    });
    const findBeerDescription = (name, obj) => {
        if (!name) {
            return null;
        }

        const keys = Object.keys(obj);
        const len = keys.length;

        for (let i = 0; i < len; i += 1) {
            const key = keys[i];
            const beerDescription = obj[key];
            if (beerDescription.name === name) {
                return beerDescription;
            }

            const found = findBeerDescription(name, beerDescription.children);
            if (found) {
                return found;
            }
        }

        return null;
    };


    beerDescriptions.forEach(beerDescription => {
        const { name, parent } = beerDescription;

        let description = findBeerDescription(name, descriptionMap);
        if (!description) {
            description = makeDescription(beerDescription);
        }

        if (parent) {
            let parentDescription = findBeerDescription(parent, descriptionMap);
            if (!parentDescription) {
                parentDescription = makeDescription({ name: parent });
            }

            parentDescription.children[name] = description;
            description.parents[parent] = parentDescription;
        }

        descriptionMap[name] = description;
    });

    Object.keys(descriptionMap).forEach(key => {
        const description = descriptionMap[key];
        if (Object.keys(description.parents).length > 0) {
            return;
        }

        descriptionTree[description.name] = description;
    });

    console.log(descriptionMap);
    console.log(descriptionTree);
    
    const selected = [];
    const createListItem = (description, depth) => {
        const text = document.createTextNode(`${description.name} (${Object.values(description.children).length})`);
        const listItem = document.createElement('li');

        listItem.append(text);
        listItem.className = 'list-group-item';
        listItem.id = description.name;
        listItem.dataset.expanded = false;
        listItem.dataset.depth = depth;

        listItem.addEventListener('click', event => {
            event.stopPropagation();
            const { target } = event;

            if (target.dataset.expanded === 'true') {
                target.removeChild(target.lastChild);
                target.dataset.expanded = 'false';
                return;
            }

            const description = descriptionMap[event.target.id];
            target.appendChild(createList(Object.values(description.children), Number(listItem.dataset.depth) + 1));
            target.dataset.expanded = true;
        });

        return listItem;
    };

    const createList = (descriptions, depth = 0) => {
        const list = document.createElement('ul');
        list.dataset.depth = depth;
        list.className = 'list-group';
        if (descriptions.length === 0) {
            return null;
        }

        const listItems = descriptions.forEach(description => {
            const listItem = createListItem(description, depth);

            list.appendChild(listItem);
        });

        return list;
    };

    const formatDescription = description => {
        const formatted = {
            name: description.name,
            children: Object.values(description.children).map(formatDescription),
        };

        if (formatted.children.length === 0) {
            formatted.size = 1;
        }

        return formatted;
    };
    const formattedData = formatDescription({
        name: 'Beer Descriptions',
        children: descriptionTree
    });

    const width = 932;
    const radius = width / 6;

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1))

    const partition = data => {
        const rootNode = d3.hierarchy(data)
            .sum(d => d.size)
            .sort((a, b) => b.value - a.value);
        
        return d3.partition().size([2 * Math.PI, rootNode.height + 1])(rootNode);
    };
    const root = partition(formattedData);

    const DOM = {
        svg: function(e, t) {
            var n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            return n.setAttribute("viewBox", [0, 0, e, t]),
            n.setAttribute("width", e),
            n.setAttribute("height", t),
            n
        }
    };
    root.each(d => d.current = d);

    const color = d3.scaleOrdinal().range(d3.quantize(d3.interpolateRainbow, formattedData.children.length + 1));
    const format = d3.format(",d");

    const svg = d3.select(DOM.svg(width, width))
        .style("width", "100%")
        .style("height", "auto")
        .style("font", "12px Helvetica");

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    const path = g.append("g")
      .selectAll("path")
      .data(root.descendants().slice(1))
      .enter().append("path")
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("d", d => arc(d.current));

    path.filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    path.append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    const label = g.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
      .selectAll("text")
      .data(root.descendants().slice(1))
      .enter().append("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .text(d => d.data.name);

    const parent = g.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    function clicked(p) {
      parent.datum(p.parent || root);

      root.each(d => d.target = {
          x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth)
      });

      const t = g.transition().duration(750);

      // Transition the data on all arcs, even the ones that aren’t visible,
      // so that if this transition is interrupted, entering arcs will start
      // the next transition from the desired position.
      path.transition(t)
          .tween("data", d => {
            const i = d3.interpolate(d.current, d.target);
            return t => d.current = i(t);
          })
        .filter(function(d) {
          return +this.getAttribute("fill-opacity") || arcVisible(d.target);
        })
          .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
          .attrTween("d", d => () => arc(d.current));

      label.filter(function(d) {
          return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
          .attr("fill-opacity", d => +labelVisible(d.target))
          .attrTween("transform", d => () => labelTransform(d.current));
    }
    
    function arcVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2 * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    const app = document.getElementById('app');

    app.appendChild(svg.node());
})();
