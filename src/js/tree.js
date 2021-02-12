import $ from 'jquery';
import * as d3 from 'd3';

$(function() {
  renderGraph(data.graph); // eslint-disable-line

  $('#container-toggle').on('click', () => {
    console.log('toggled');
    $('#inner-container').toggleClass('open');
  });
});

const renderGraph = (data) => {
  let width = $('#graph').width(), height = $('#graph').height();

  const svg = d3.select('#graph').append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('pointer-events', 'all')
    .style('cursor', 'move')
    .style('font', '1.5rem "Rubik", Arial, sans-serif')
    .attr('text-anchor', 'middle');

  const container = svg.append('g'),
        linksGr = container.append('g'),
        nodesGr = container.append('g'),
        // nodesTxGr = container.append('g'),
        x = d3.scaleLinear([0,1], [0,100]),
        y = d3.scaleLinear([0,1], [0,100]);

  let label = {
    'nodes': [],
    'links': []
  };


      data.nodes.forEach((d,i) => {
        label.nodes.push({node: d});
        label.nodes.push({node: d});
        label.links.push({
          source: i * 2,
          target: i * 2 + 1
        });
      });

      console.log(data.links);

      const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink().distance(250).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-1000))
        .force('center', d3.forceCenter(width / 2, height /2));

      const link = linksGr
          .attr('stroke', '#6E7191')
        .selectAll('line')
        .data(data.links)
        .join('line')
          .attr('stroke-width', '3')
          .attr('stroke', '#6E7191')
          .attr('class', d => d.relType);

      const node = nodesGr
          .attr('stroke-width', 1.5)
        .selectAll('g')
        .data(data.nodes)
        .join('g')
          .attr('cx', d => x(d[1]))
          .attr('cy', d => y(d[2]))
          .call(drag(simulation));

      node.append('circle')
        .attr('id', (d, i) => {
          d.nodeUid = 'node-' + i;
          return d.nodeUid;
        })
        .attr('r', 40)
        .attr('stroke', '#0ab4ff')
        .attr('fill', '#f7f7fc')
        .attr('cx', d => x(d[1]))
        .attr('cy', d => y(d[2]));

      node.append('text')
        .text(d => `${d.fname} ${d.lname}`)
        .style('fill', '#4e4b66');

      node.append('title')
        .text(d => {
          return `${d.fname} ${d.lname}`;
        });

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .selectAll('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        node
          .selectAll('clipPath')
            .attr('dx', d => d.x)
            .attr('dy', d => d.y);

        node
          .selectAll('text')
            .attr('dx', d => d.x)
            .attr('dy', d => d.y);
    });

    let transform;

    const zoom = d3.zoom()
      .scaleExtent([.1, 4])
      .on('zoom', e => {
        container.attr('transform', (transform = e.transform)); // eslint-disable-line
      });

    return svg
      .call(zoom)
      .call(zoom.transform, d3.zoomIdentity)
      .node();


};

const drag = simulation => {
  function dragstarted(event) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
};

if(typeof(module.hot) !== 'undefined') {
  module.hot.accept(); // eslint-disable-line no-undef
}