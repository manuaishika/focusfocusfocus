document.addEventListener('DOMContentLoaded', async () => {
  const heatmapContainer = document.getElementById('heatmap-container');

  if (!heatmapContainer) {
    console.error('Heatmap container not found');
    return;
  }

  if (!chrome || !chrome.storage) {
    heatmapContainer.innerHTML = '<p>Error: Chrome storage API not available</p>';
    return;
  }

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'progress', 'taskTypes']);
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const taskTypes = result.taskTypes || {};
      
      // Only show daily tasks in heatmap
      const allTasks = [...permanentTasks, ...customTasks];
      const tasks = allTasks.filter(task => (taskTypes[task] || 'daily') === 'daily');
      
      const progress = result.progress || {};

      if (heatmapContainer) {
        heatmapContainer.innerHTML = '';

        tasks.forEach(task => {
          const taskHeatmap = document.createElement('div');
          taskHeatmap.className = 'task-heatmap';

          const title = document.createElement('div');
          title.className = 'task-title';
          title.textContent = task;
          taskHeatmap.appendChild(title);

          // Create GitHub-style heatmap container
          const heatmapWrapper = document.createElement('div');
          heatmapWrapper.className = 'github-heatmap-wrapper';
          
          // Create heatmap table structure
          const heatmapTable = document.createElement('table');
          heatmapTable.className = 'github-heatmap';
          
          // Create header row for month labels
          const thead = document.createElement('thead');
          const monthRow = document.createElement('tr');
          monthRow.className = 'month-row';
          
          // Create body for day labels and cells
          const tbody = document.createElement('tbody');
          tbody.className = 'weeks-row';
          
          // Generate last 53 weeks (371 days to cover partial weeks)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 371);
          
          // Adjust to start of week (Sunday)
          const startDay = startDate.getDay();
          startDate.setDate(startDate.getDate() - startDay);
          
          // Build weeks array
          const weeks = [];
          const currentDate = new Date(startDate);
          let currentWeek = [];
          let weekIndex = 0;
          
          // Track months for header
          const monthPositions = {};
          
          while (currentDate <= today || currentWeek.length > 0) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayOfWeek = currentDate.getDay();
            const isFuture = currentDate > today;
            const completed = !isFuture && (progress[dateStr] && progress[dateStr][task] || false);
            
            // Track month positions
            const monthKey = currentDate.toLocaleString('default', { month: 'short' });
            if (!monthPositions[monthKey] && currentDate <= today) {
              monthPositions[monthKey] = weekIndex;
            }
            
            currentWeek.push({
              date: dateStr,
              dayOfWeek: dayOfWeek,
              completed: completed,
              isFuture: isFuture,
              dateObj: new Date(currentDate)
            });
            
            if (dayOfWeek === 6) { // Saturday - end of week
              weeks.push([...currentWeek]);
              currentWeek = [];
              weekIndex++;
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          if (currentWeek.length > 0) {
            // Pad last week
            while (currentWeek.length < 7) {
              currentWeek.push(null);
            }
            weeks.push(currentWeek);
          }
          
          // Create month header - show month label at start of each month
          const monthCells = [document.createElement('th')]; // Empty cell for day labels column
          
          // Track months and their positions
          const monthMap = new Map();
          let currentMonth = -1;
          let monthStartWeek = 0;
          
          weeks.forEach((week, weekIdx) => {
            // Find first day of week that's not future
            const weekDay = week.find(d => d !== null && !d.isFuture);
            if (weekDay) {
              const dayMonth = weekDay.dateObj.getMonth();
              const dayDate = weekDay.dateObj.getDate();
              
              // Check if this is the start of a new month
              // (either month changed, or we're at the beginning and it's day 1-7)
              if (dayMonth !== currentMonth) {
                if (currentMonth !== -1) {
                  // Save previous month
                  const prevWeek = weeks[monthStartWeek];
                  if (prevWeek) {
                    const prevDay = prevWeek.find(d => d !== null);
                    if (prevDay) {
                      monthMap.set(monthStartWeek, {
                        month: prevDay.dateObj.toLocaleString('default', { month: 'short' }),
                        span: weekIdx - monthStartWeek
                      });
                    }
                  }
                }
                monthStartWeek = weekIdx;
                currentMonth = dayMonth;
              }
            }
          });
          
          // Add last month
          if (monthStartWeek < weeks.length) {
            const lastWeek = weeks[monthStartWeek];
            if (lastWeek) {
              const lastDay = lastWeek.find(d => d !== null);
              if (lastDay) {
                monthMap.set(monthStartWeek, {
                  month: lastDay.dateObj.toLocaleString('default', { month: 'short' }),
                  span: weeks.length - monthStartWeek
                });
              }
            }
          }
          
          // Create month header cells in order
          const sortedWeeks = Array.from(monthMap.keys()).sort((a, b) => a - b);
          sortedWeeks.forEach(weekIdx => {
            const monthInfo = monthMap.get(weekIdx);
            const monthCell = document.createElement('th');
            monthCell.className = 'month-label';
            monthCell.textContent = monthInfo.month;
            monthCell.colSpan = monthInfo.span;
            monthCells.push(monthCell);
          });
          
          monthRow.append(...monthCells);
          thead.appendChild(monthRow);
          heatmapTable.appendChild(thead);
          
          // Create rows for each day of week
          const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const row = document.createElement('tr');
            
            // Add day label (only for Mon, Wed, Fri)
            const dayLabelCell = document.createElement('td');
            dayLabelCell.className = 'day-label';
            if (dayIdx === 1 || dayIdx === 3 || dayIdx === 5) {
              dayLabelCell.textContent = dayLabels[dayIdx];
            }
            row.appendChild(dayLabelCell);
            
            // Add cells for each week
            weeks.forEach(week => {
              const day = week[dayIdx];
              const cell = document.createElement('td');
              cell.className = 'heatmap-cell-container';
              
              if (day) {
                const dayCell = document.createElement('div');
                dayCell.className = 'heatmap-cell';
                
                if (day.isFuture) {
                  dayCell.style.backgroundColor = '#ffffff';
                  dayCell.style.border = '1px solid #ccc';
                  dayCell.title = `${day.date}: Future date`;
                } else {
                  dayCell.style.backgroundColor = day.completed ? '#00072D' : '#ebedf0';
                  const dateObj = new Date(day.date);
                  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  dayCell.title = `${dateStr}: ${day.completed ? 'Completed' : 'Not completed'}`;
                }
                
                cell.appendChild(dayCell);
              }
              
              row.appendChild(cell);
            });
            
            tbody.appendChild(row);
          }
          
          heatmapTable.appendChild(tbody);
          heatmapWrapper.appendChild(heatmapTable);
          taskHeatmap.appendChild(heatmapWrapper);
          heatmapContainer.appendChild(taskHeatmap);
        });
      }
    } catch (error) {
      if (heatmapContainer) {
        heatmapContainer.innerHTML = `<p>Error loading data: ${error.message}</p>`;
      }
      console.error('Error loading heatmap data:', error);
    }
  }

  loadData();
});

