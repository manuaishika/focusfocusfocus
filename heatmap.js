document.addEventListener('DOMContentLoaded', async () => {
  const heatmapContainer = document.getElementById('heatmap-container');

  async function loadData() {
    const result = await chrome.storage.local.get(['tasks', 'progress']);
    const tasks = result.tasks || ['LeetCode', 'GRE Practice'];
    const progress = result.progress || {};

    heatmapContainer.innerHTML = '';

    tasks.forEach(task => {
      const taskHeatmap = document.createElement('div');
      taskHeatmap.className = 'task-heatmap';

      const title = document.createElement('div');
      title.className = 'task-title';
      title.textContent = task;
      taskHeatmap.appendChild(title);

      const chartDiv = document.createElement('div');
      chartDiv.id = `heatmap-${task}`;
      taskHeatmap.appendChild(chartDiv);

      heatmapContainer.appendChild(taskHeatmap);

      const data = {};
      Object.keys(progress).forEach(date => {
        if (progress[date][task]) {
          data[date] = 1;
        }
      });

      const cal = new CalHeatmap();
      cal.paint({
        itemSelector: `#heatmap-${task}`,
        data: data,
        domain: {
          type: 'month',
          label: { text: 'MMM', textAlign: 'start', position: 'top' }
        },
        subDomain: {
          type: 'day',
          radius: 2,
          label: 'DD'
        },
        range: 12,
        scale: {
          color: {
            type: 'linear',
            range: ['#ebedf0', '#40c463'],
            domain: [0, 1]
          }
        },
        date: {
          start: new Date(new Date().setMonth(new Date().getMonth() - 11))
        }
      });
    });
  }

  loadData();
});

