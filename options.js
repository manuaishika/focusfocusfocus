document.addEventListener('DOMContentLoaded', async () => {
  const tasksContainer = document.getElementById('tasks-container');
  const newTaskInput = document.getElementById('new-task-input');
  const addTaskBtn = document.getElementById('add-task-btn');

  async function loadTasks() {
    const result = await chrome.storage.local.get(['tasks']);
    const tasks = result.tasks || ['LeetCode', 'GRE Practice'];
    renderTasks(tasks);
  }

  function renderTasks(tasks) {
    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row';
      
      const span = document.createElement('span');
      span.textContent = task;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        const result = await chrome.storage.local.get(['tasks']);
        const tasks = result.tasks || [];
        const updatedTasks = tasks.filter(t => t !== task);
        await chrome.storage.local.set({ tasks: updatedTasks });
        renderTasks(updatedTasks);
      });

      taskRow.appendChild(span);
      taskRow.appendChild(deleteBtn);
      tasksContainer.appendChild(taskRow);
    });
  }

  addTaskBtn.addEventListener('click', async () => {
    const taskName = newTaskInput.value.trim();
    if (taskName) {
      const result = await chrome.storage.local.get(['tasks']);
      const tasks = result.tasks || [];
      if (!tasks.includes(taskName)) {
        tasks.push(taskName);
        await chrome.storage.local.set({ tasks });
        renderTasks(tasks);
        newTaskInput.value = '';
      }
    }
  });

  newTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTaskBtn.click();
    }
  });

  loadTasks();
});

