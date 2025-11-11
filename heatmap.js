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
      chartDiv.className = 'heatmap-grid';
      taskHeatmap.appendChild(chartDiv);

      heatmapContainer.appendChild(taskHeatmap);

      // Generate last 365 days
      const days = [];
      const today = new Date();
      for (let i = 364; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days.push({
          date: dateStr,
          completed: progress[dateStr] && progress[dateStr][task] || false
        });
      }

      // Render heatmap
      days.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.style.backgroundColor = day.completed ? '#40c463' : '#ebedf0';
        cell.title = `${day.date}: ${day.completed ? 'Completed' : 'Not completed'}`;
        chartDiv.appendChild(cell);
      });
    });
  }

  loadData();
});

