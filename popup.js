document.addEventListener('DOMContentLoaded', async () => {
  const tasksList = document.getElementById('tasks-list');
  const viewHeatmapBtn = document.getElementById('view-heatmap');
  const optionsBtn = document.getElementById('options');

  if (!chrome || !chrome.storage) {
    if (tasksList) {
      tasksList.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['tasks', 'progress']);
      const tasks = result.tasks || ['LeetCode', 'GRE Practice'];
      const progress = result.progress || {};
      const todayProgress = progress[today] || {};

      if (tasksList) {
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
            try {
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
            } catch (error) {
              console.error('Error saving progress:', error);
            }
          });

          taskItem.appendChild(checkbox);
          taskItem.appendChild(label);
          tasksList.appendChild(taskItem);
        });
      }
    } catch (error) {
      if (tasksList) {
        tasksList.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading data:', error);
    }
  }

  if (viewHeatmapBtn) {
    viewHeatmapBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('heatmap.html') });
    });
  }

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  loadData();
});

