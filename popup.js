document.addEventListener('DOMContentLoaded', async () => {
  const tasksList = document.getElementById('tasks-list');
  const viewHeatmapBtn = document.getElementById('view-heatmap');
  const optionsBtn = document.getElementById('options');

  const today = new Date().toISOString().split('T')[0];

  async function loadData() {
    const result = await chrome.storage.local.get(['tasks', 'progress']);
    const tasks = result.tasks || ['LeetCode', 'GRE Practice'];
    const progress = result.progress || {};
    const todayProgress = progress[today] || {};

    tasksList.innerHTML = '';

    tasks.forEach(task => {
      const taskItem = document.createElement('div');
      taskItem.className = 'task-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `task-${task}`;
      checkbox.checked = todayProgress[task] || false;
      
      const label = document.createElement('label');
      label.htmlFor = `task-${task}`;
      label.textContent = task;

      if (checkbox.checked) {
        taskItem.classList.add('completed');
      }

      checkbox.addEventListener('change', async () => {
        const result = await chrome.storage.local.get(['progress']);
        const progress = result.progress || {};
        if (!progress[today]) {
          progress[today] = {};
        }
        progress[today][task] = checkbox.checked;
        
        if (checkbox.checked) {
          taskItem.classList.add('completed');
        } else {
          taskItem.classList.remove('completed');
        }

        await chrome.storage.local.set({ progress });
      });

      taskItem.appendChild(checkbox);
      taskItem.appendChild(label);
      tasksList.appendChild(taskItem);
    });
  }

  viewHeatmapBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('heatmap.html') });
  });

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  loadData();
});

