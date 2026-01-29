import React, { useState, useCallback } from 'react';
import { Upload, Calendar, DollarSign, Users, TrendingUp, Edit2, Save, X, Download, Plus, Trash2 } from 'lucide-react';

const TipPoolManagementSystem = () => {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([
    { id: 1, name: 'Alex Martinez', role: 'bartender', color: '#22c55e', phone: '', tellerAccount: '' },
    { id: 2, name: 'Jordan Lee', role: 'bartender', color: '#3b82f6', phone: '', tellerAccount: '' },
    { id: 3, name: 'Sam Rivera', role: 'expo', color: '#06b6d4', phone: '', tellerAccount: '' }
  ]);
  const [activeView, setActiveView] = useState('dashboard');
  const [editingShift, setEditingShift] = useState(null);
  const [newEmployee, setNewEmployee] = useState({ name: '', role: 'bartender' });
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [importedData, setImportedData] = useState(null);
  const [employeeMapping, setEmployeeMapping] = useState({});
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [weekStartDate, setWeekStartDate] = useState(getWeekStartDate(new Date()));

  // Get current week number
  function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
  }

  // Get the start date (Sunday) of a given week
  function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday is 0
    return new Date(d.setDate(diff));
  }

  // Generate 7 days from a start date
  function getWeekDates(startDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }

  // Get or create shift for a specific date
  function getShiftForDate(date) {
    let shift = shifts.find(s => s.date === date);
    if (!shift) {
      shift = {
        id: Date.now() + Math.random(),
        date: date,
        employeeIds: [],
        hours: {},
        cashTips: 0,
        creditTips: 0,
        week: getCurrentWeek(),
        expoIds: []
      };
      setShifts(prev => [...prev, shift]);
    }
    return shift;
  }

  // Parse CSV file
  const handleCSVUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split('\n').map(row => row.split(','));
      
      // Extract dates from first row (skip first column which is empty)
      const dates = rows[0].slice(1).filter(d => d.trim());
      
      // Find where "Scheduled shifts" starts
      const scheduledIndex = rows.findIndex(row => row[0]?.includes('Scheduled shifts'));
      if (scheduledIndex === -1) return;
      
      // Extract employee data
      const employeeShifts = {};
      const uniqueEmployees = new Set();
      
      for (let i = scheduledIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const employeeName = row[0]?.trim();
        
        if (!employeeName) continue;
        
        uniqueEmployees.add(employeeName);
        employeeShifts[employeeName] = [];
        
        // Parse shifts for each date
        for (let j = 1; j < row.length && j <= dates.length; j++) {
          let cellContent = row[j]?.trim();
          if (!cellContent) continue;
          
          // Skip entries that are time off, unavailable, or all day
          if (cellContent.includes('Time off') || 
              cellContent.includes('Unavailable') || 
              cellContent.includes('All day')) {
            continue;
          }
          
          // Remove location/venue text (e.g., "Bartender • Doughboy Swift", "expo / to go • Doughboy Swift")
          cellContent = cellContent.replace(/Bartender\s*•\s*[^•\n]*/gi, '');
          cellContent = cellContent.replace(/expo\s*\/\s*to\s*go\s*•\s*[^•\n]*/gi, '');
          cellContent = cellContent.trim();
          
          // If nothing left after cleaning, skip
          if (!cellContent) continue;
          
          // Extract time
          const timeMatch = cellContent.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          
          if (timeMatch && dates[j-1]) {
            const startTime = timeMatch[1];
            const endTime = timeMatch[2];
            
            // Calculate hours
            const start = parseTime(startTime);
            const end = parseTime(endTime);
            let hours = end - start;
            if (hours < 0) hours += 24; // Handle overnight shifts
            
            employeeShifts[employeeName].push({
              date: dates[j-1],
              startTime,
              endTime,
              hours: Math.round(hours * 10) / 10 // Round to 1 decimal
            });
          }
        }
      }
      
      // Filter out employees with no valid shifts
      const employeesWithShifts = Array.from(uniqueEmployees).filter(
        name => employeeShifts[name] && employeeShifts[name].length > 0
      );
      
      if (employeesWithShifts.length === 0) {
        alert('No valid shifts found in CSV file');
        return;
      }
      
      // Set imported data for mapping
      setImportedData({
        employees: employeesWithShifts,
        shifts: employeeShifts
      });
      setActiveView('import-mapping');
    };
    reader.readAsText(file);
  }, []);

  // Helper function to parse time strings
  const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours + minutes / 60;
  };

  // Complete the import after mapping
  const completeImport = () => {
    if (!importedData) return;
    
    const newShifts = [];
    const dateShiftsMap = {};
    
    // Group by date
    Object.entries(importedData.shifts).forEach(([employeeName, shifts]) => {
      const mappedRole = employeeMapping[employeeName];
      if (!mappedRole) return;
      
      // Find or create employee
      let employee = employees.find(e => e.name === employeeName);
      if (!employee) {
        const colors = ['#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
        employee = {
          id: Date.now() + Math.random(),
          name: employeeName,
          role: mappedRole,
          color: colors[employees.length % colors.length],
          phone: '',
          tellerAccount: ''
        };
        setEmployees(prev => [...prev, employee]);
      }
      
      shifts.forEach(shift => {
        const dateKey = shift.date;
        if (!dateShiftsMap[dateKey]) {
          dateShiftsMap[dateKey] = {
            id: Date.now() + Math.random(),
            date: formatDateForInput(shift.date),
            employeeIds: [],
            hours: {},
            cashTips: 0,
            creditTips: 0,
            week: getCurrentWeek(),
            expoIds: []
          };
        }
        
        if (mappedRole === 'bartender') {
          if (!dateShiftsMap[dateKey].employeeIds.includes(employee.id)) {
            dateShiftsMap[dateKey].employeeIds.push(employee.id);
          }
          dateShiftsMap[dateKey].hours[employee.id] = shift.hours;
        } else {
          if (!dateShiftsMap[dateKey].expoIds.includes(employee.id)) {
            dateShiftsMap[dateKey].expoIds.push(employee.id);
          }
        }
      });
    });
    
    setShifts(prev => [...prev, ...Object.values(dateShiftsMap)]);
    setImportedData(null);
    setEmployeeMapping({});
    setActiveView('shifts');
  };

  // Format date string for input
  const formatDateForInput = (dateStr) => {
    // dateStr is in format "2026-01-26"
    return dateStr;
  };

  // Get day of week from date string
  const getDayOfWeek = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Get day abbreviation from date string
  const getDayAbbreviation = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  // Format days worked for display
  const formatDaysWorked = (daysSet) => {
    if (!daysSet || daysSet.size === 0) return '';
    const sortedDates = Array.from(daysSet).sort();
    return sortedDates.map(date => getDayAbbreviation(date)).join(', ');
  };

  // Export weekly summary as PDF
  const exportWeeklySummaryPDF = () => {
    const weekShifts = shifts.filter(s => s.week === selectedWeek);
    const breakdown = getWeeklyBreakdown();
    
    // Create summary data
    const summaryData = employees
      .filter(emp => breakdown[emp.id]?.shifts > 0)
      .map(emp => {
        const details = breakdown[emp.id];
        const total = details.cashTips + details.creditTips;
        return {
          name: emp.name,
          role: emp.role,
          shifts: details.shifts,
          daysWorked: formatDaysWorked(details.daysWorked),
          totalHours: details.totalHours,
          cashTips: details.cashTips,
          creditTips: details.creditTips,
          creditFee: details.creditFee,
          total: total
        };
      });

    const grandTotal = summaryData.reduce((sum, emp) => sum + emp.total, 0);

    // Import jsPDF dynamically
    import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then((module) => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;
      
      // Title
      doc.setFontSize(24);
      doc.setTextColor(6, 182, 212);
      doc.text('Weekly Tip Pool Summary', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 10;
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Week ${selectedWeek} • Generated ${today}`, pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      
      // Employee breakdown
      summaryData.forEach((emp, index) => {
        // Check if we need a new page
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 20;
        }
        
        // Employee name
        doc.setFontSize(14);
        doc.setTextColor(226, 232, 240);
        doc.text(emp.name, 20, yPos);
        yPos += 7;
        
        // Meta info
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        let metaInfo = `${emp.role} • ${emp.shifts} shift${emp.shifts !== 1 ? 's' : ''}`;
        if (emp.daysWorked) metaInfo += ` • ${emp.daysWorked}`;
        if (emp.totalHours > 0) metaInfo += ` • ${emp.totalHours.toFixed(1)} hrs`;
        doc.text(metaInfo, 20, yPos);
        yPos += 10;
        
        // Breakdown box
        doc.setFillColor(30, 41, 59);
        doc.rect(20, yPos, pageWidth - 40, 35, 'F');
        
        doc.setFontSize(11);
        doc.setTextColor(148, 163, 184);
        
        let boxY = yPos + 7;
        doc.text('Cash Tips', 25, boxY);
        doc.setTextColor(226, 232, 240);
        doc.text(`$${emp.cashTips.toFixed(2)}`, pageWidth - 25, boxY, { align: 'right' });
        
        boxY += 6;
        doc.setTextColor(148, 163, 184);
        doc.text('Credit Tips', 25, boxY);
        doc.setTextColor(226, 232, 240);
        doc.text(`$${emp.creditTips.toFixed(2)}`, pageWidth - 25, boxY, { align: 'right' });
        
        if (emp.creditFee > 0) {
          boxY += 6;
          doc.setTextColor(239, 68, 68);
          doc.text('Credit Card Fee (3%)', 25, boxY);
          doc.text(`-$${emp.creditFee.toFixed(2)}`, pageWidth - 25, boxY, { align: 'right' });
        }
        
        yPos += 35;
        
        // Divider
        doc.setDrawColor(51, 65, 85);
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 5;
        
        // Total box
        doc.setFillColor(15, 23, 42);
        doc.rect(20, yPos, pageWidth - 40, 10, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(226, 232, 240);
        doc.text('Total to Receive', 25, yPos + 7);
        doc.setTextColor(34, 197, 94);
        doc.text(`$${emp.total.toFixed(2)}`, pageWidth - 25, yPos + 7, { align: 'right' });
        
        yPos += 20;
      });
      
      // Grand Total
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos += 10;
      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.5);
      doc.rect(20, yPos, pageWidth - 40, 15, 'FD');
      
      doc.setFontSize(14);
      doc.setTextColor(226, 232, 240);
      doc.text('GRAND TOTAL', 25, yPos + 10);
      doc.setTextColor(6, 182, 212);
      doc.text(`$${grandTotal.toFixed(2)}`, pageWidth - 25, yPos + 10, { align: 'right' });
      
      // Save PDF
      doc.save(`weekly-summary-week-${selectedWeek}.pdf`);
    });
  };

  // Add new employee
  const addEmployee = () => {
    if (!newEmployee.name) return;
    
    const colors = ['#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899'];
    setEmployees(prev => [...prev, {
      id: Date.now(),
      name: newEmployee.name,
      role: newEmployee.role,
      color: colors[Math.floor(Math.random() * colors.length)],
      phone: '',
      tellerAccount: ''
    }]);
    setNewEmployee({ name: '', role: 'bartender' });
  };

  // Update employee details
  const updateEmployee = (id, updates) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === id ? { ...emp, ...updates } : emp
    ));
  };

  // Delete employee
  const deleteEmployee = (id) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  // Add manual shift
  const addManualShift = () => {
    const newShift = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      employeeIds: [],
      hours: {},
      cashTips: 0,
      creditTips: 0,
      week: getCurrentWeek(),
      expoIds: []
    };
    setShifts(prev => [...prev, newShift]);
    setEditingShift(newShift.id);
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStartDate);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStartDate(newStart);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newStart = new Date(weekStartDate);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStartDate(newStart);
  };

  // Jump to today's week
  const goToCurrentWeek = () => {
    setWeekStartDate(getWeekStartDate(new Date()));
  };

  // Delete shift
  const deleteShift = (id) => {
    setShifts(prev => prev.filter(s => s.id !== id));
    if (editingShift === id) setEditingShift(null);
  };

  // Update shift
  const updateShift = (id, updates) => {
    setShifts(prev => prev.map(shift => 
      shift.id === id ? { ...shift, ...updates } : shift
    ));
  };

  // Calculate tip distribution for a shift
  const calculateShiftTips = (shift) => {
    const bartenders = shift.employeeIds.map(id => employees.find(e => e.id === id)).filter(Boolean);
    const expos = shift.expoIds?.map(id => employees.find(e => e.id === id)).filter(Boolean) || [];
    
    // Deduct 3% processing fee from credit card tips
    const creditTipsAfterFee = parseFloat(shift.creditTips || 0) * 0.97;
    const totalTips = parseFloat(shift.cashTips || 0) + creditTipsAfterFee;
    const expoTips = totalTips * 0.1 * expos.length;
    const bartenderTips = totalTips - expoTips;
    
    const totalHours = bartenders.reduce((sum, b) => sum + (parseFloat(shift.hours[b.id] || 0)), 0);
    const hourlyRate = totalHours > 0 ? bartenderTips / totalHours : 0;
    
    const distribution = {};
    bartenders.forEach(b => {
      const hours = parseFloat(shift.hours[b.id] || 0);
      distribution[b.id] = hours * hourlyRate;
    });
    
    expos.forEach(e => {
      distribution[e.id] = totalTips * 0.1;
    });
    
    return distribution;
  };

  // Calculate weekly totals
  const getWeeklyTotals = () => {
    const weekShifts = shifts.filter(s => s.week === selectedWeek);
    const totals = {};
    
    weekShifts.forEach(shift => {
      const distribution = calculateShiftTips(shift);
      Object.entries(distribution).forEach(([empId, amount]) => {
        totals[empId] = (totals[empId] || 0) + amount;
      });
    });
    
    return totals;
  };

  // Calculate detailed weekly breakdown by employee
  const getWeeklyBreakdown = () => {
    const weekShifts = shifts.filter(s => s.week === selectedWeek);
    const breakdown = {};
    
    // Initialize breakdown for all employees
    employees.forEach(emp => {
      breakdown[emp.id] = {
        employeeId: emp.id,
        cashTips: 0,
        creditTips: 0,
        creditFee: 0,
        totalHours: 0,
        shifts: 0,
        daysWorked: new Set()
      };
    });
    
    weekShifts.forEach(shift => {
      const bartenders = shift.employeeIds.map(id => employees.find(e => e.id === id)).filter(Boolean);
      const expos = shift.expoIds?.map(id => employees.find(e => e.id === id)).filter(Boolean) || [];
      
      const cashTips = parseFloat(shift.cashTips || 0);
      const creditTipsRaw = parseFloat(shift.creditTips || 0);
      const creditFee = creditTipsRaw * 0.03;
      const creditTipsAfterFee = creditTipsRaw * 0.97;
      
      const totalTips = cashTips + creditTipsAfterFee;
      const expoTipsTotal = totalTips * 0.1 * expos.length;
      const bartenderTipsTotal = totalTips - expoTipsTotal;
      
      const totalHours = bartenders.reduce((sum, b) => sum + (parseFloat(shift.hours[b.id] || 0)), 0);
      
      // Calculate proportional cash and credit for bartenders
      const bartenderCashPortion = bartenderTipsTotal > 0 ? (cashTips * bartenderTipsTotal / totalTips) : 0;
      const bartenderCreditPortion = bartenderTipsTotal > 0 ? (creditTipsAfterFee * bartenderTipsTotal / totalTips) : 0;
      
      // Calculate for bartenders
      bartenders.forEach(b => {
        const hours = parseFloat(shift.hours[b.id] || 0);
        if (hours > 0 && breakdown[b.id]) {
          const bartenderShare = totalHours > 0 ? hours / totalHours : 0;
          
          breakdown[b.id].totalHours += hours;
          breakdown[b.id].shifts += 1;
          breakdown[b.id].daysWorked.add(shift.date);
          breakdown[b.id].cashTips += bartenderCashPortion * bartenderShare;
          breakdown[b.id].creditTips += bartenderCreditPortion * bartenderShare;
          breakdown[b.id].creditFee += (bartenderCreditPortion * bartenderShare) / 0.97 * 0.03;
        }
      });
      
      // Calculate proportional cash and credit for expos
      const expoCashPortion = expoTipsTotal > 0 ? (cashTips * expoTipsTotal / totalTips) : 0;
      const expoCreditPortion = expoTipsTotal > 0 ? (creditTipsAfterFee * expoTipsTotal / totalTips) : 0;
      
      // Calculate for expos
      expos.forEach(e => {
        if (breakdown[e.id]) {
          const expoSharePerPerson = 1 / expos.length;
          
          breakdown[e.id].shifts += 1;
          breakdown[e.id].daysWorked.add(shift.date);
          breakdown[e.id].cashTips += expoCashPortion * expoSharePerPerson;
          breakdown[e.id].creditTips += expoCreditPortion * expoSharePerPerson;
          breakdown[e.id].creditFee += (expoCreditPortion * expoSharePerPerson) / 0.97 * 0.03;
        }
      });
    });
    
    return breakdown;
  };

  // Render shift editor
  const ShiftEditor = ({ shift }) => {
    const isEditing = editingShift === shift.id;
    const bartenderEmployees = employees.filter(e => e.role === 'bartender');
    const expoEmployees = employees.filter(e => e.role === 'expo');
    const distribution = calculateShiftTips(shift);

    return (
      <div className="shift-card" style={{ borderLeft: `4px solid ${isEditing ? '#06b6d4' : '#334155'}` }}>
        <div className="shift-header">
          <div className="shift-date">
            <Calendar size={18} />
            <div className="date-info">
              <input
                type="date"
                value={shift.date}
                onChange={(e) => updateShift(shift.id, { date: e.target.value })}
                disabled={!isEditing}
                className="date-input"
              />
              <span className="day-of-week">{getDayOfWeek(shift.date)}</span>
            </div>
          </div>
          <div className="shift-actions">
            {isEditing ? (
              <button onClick={() => setEditingShift(null)} className="btn-icon btn-save">
                <Save size={18} />
              </button>
            ) : (
              <button onClick={() => setEditingShift(shift.id)} className="btn-icon">
                <Edit2 size={18} />
              </button>
            )}
            <button onClick={() => deleteShift(shift.id)} className="btn-icon btn-delete">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="shift-section">
          <h4>Bartenders</h4>
          {isEditing && (
            <div className="employee-select">
              {bartenderEmployees.map(emp => (
                <label key={emp.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={shift.employeeIds.includes(emp.id)}
                    onChange={(e) => {
                      const newIds = e.target.checked
                        ? [...shift.employeeIds, emp.id]
                        : shift.employeeIds.filter(id => id !== emp.id);
                      updateShift(shift.id, { employeeIds: newIds });
                    }}
                  />
                  <span style={{ color: emp.color }}>{emp.name}</span>
                </label>
              ))}
            </div>
          )}
          
          <div className="hours-grid">
            {shift.employeeIds.map(empId => {
              const emp = employees.find(e => e.id === empId);
              if (!emp) return null;
              
              return (
                <div key={empId} className="hours-row">
                  <span className="emp-name" style={{ color: emp.color }}>{emp.name}</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={shift.hours[empId] || ''}
                    onChange={(e) => updateShift(shift.id, { 
                      hours: { ...shift.hours, [empId]: e.target.value }
                    })}
                    disabled={!isEditing}
                    className="hours-input"
                    placeholder="0"
                  />
                  <span className="hours-label">hrs</span>
                  {distribution[empId] !== undefined && (
                    <span className="tip-amount">${distribution[empId].toFixed(2)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {expoEmployees.length > 0 && (
          <div className="shift-section">
            <h4>Expo (10% of total)</h4>
            {isEditing && (
              <div className="employee-select">
                {expoEmployees.map(emp => (
                  <label key={emp.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={shift.expoIds?.includes(emp.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked
                          ? [...(shift.expoIds || []), emp.id]
                          : (shift.expoIds || []).filter(id => id !== emp.id);
                        updateShift(shift.id, { expoIds: newIds });
                      }}
                    />
                    <span style={{ color: emp.color }}>{emp.name}</span>
                  </label>
                ))}
              </div>
            )}
            
            {shift.expoIds?.map(empId => {
              const emp = employees.find(e => e.id === empId);
              if (!emp) return null;
              
              return (
                <div key={empId} className="expo-row">
                  <span className="emp-name" style={{ color: emp.color }}>{emp.name}</span>
                  {distribution[empId] !== undefined && (
                    <span className="tip-amount">${distribution[empId].toFixed(2)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="shift-section">
          <h4>Tips</h4>
          <div className="tips-grid">
            <div className="tip-input-group">
              <label>Cash</label>
              <div className="input-with-icon">
                <DollarSign size={16} />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shift.cashTips || ''}
                  onChange={(e) => updateShift(shift.id, { cashTips: e.target.value })}
                  disabled={!isEditing}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="tip-input-group">
              <label>Credit</label>
              <div className="input-with-icon">
                <DollarSign size={16} />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shift.creditTips || ''}
                  onChange={(e) => updateShift(shift.id, { creditTips: e.target.value })}
                  disabled={!isEditing}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <div className="total-tips">
            Total: ${((parseFloat(shift.cashTips) || 0) + ((parseFloat(shift.creditTips) || 0) * 0.97)).toFixed(2)}
            {parseFloat(shift.creditTips) > 0 && (
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                (Credit card fee: -${((parseFloat(shift.creditTips) || 0) * 0.03).toFixed(2)})
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render views
  const weekShifts = shifts.filter(s => s.week === selectedWeek);
  const weeklyTotals = getWeeklyTotals();
  const weeklyBreakdown = getWeeklyBreakdown();

  return (
    <div className="app">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #e2e8f0;
          min-height: 100vh;
        }

        .app {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        header {
          margin-bottom: 3rem;
        }

        h1 {
          font-size: 2.5rem;
          font-weight: 300;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #06b6d4 0%, #22c55e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: #94a3b8;
          font-size: 1rem;
          font-weight: 400;
        }

        nav {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid #334155;
          padding-bottom: 1rem;
        }

        .nav-btn {
          background: none;
          border: none;
          color: #94a3b8;
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-btn:hover {
          background: rgba(6, 182, 212, 0.1);
          color: #06b6d4;
        }

        .nav-btn.active {
          background: rgba(6, 182, 212, 0.2);
          color: #06b6d4;
          box-shadow: inset 0 -2px 0 #06b6d4;
        }

        .dashboard {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border-radius: 16px;
          padding: 1.5rem;
          border: 1px solid #334155;
          transition: all 0.3s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(6, 182, 212, 0.15);
          border-color: #06b6d4;
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          color: #94a3b8;
          font-size: 0.875rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(6, 182, 212, 0.1);
          color: #06b6d4;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 200;
          color: #e2e8f0;
          letter-spacing: -0.02em;
        }

        .stat-label {
          color: #64748b;
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .content-section {
          background: #1e293b;
          border-radius: 16px;
          padding: 2rem;
          border: 1px solid #334155;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        h2 {
          font-size: 1.5rem;
          font-weight: 400;
          color: #e2e8f0;
        }

        .btn {
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
        }

        .btn-secondary {
          background: #334155;
        }

        .btn-secondary:hover {
          background: #475569;
        }

        .upload-area {
          border: 2px dashed #334155;
          border-radius: 12px;
          padding: 3rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 2rem;
        }

        .upload-area:hover {
          border-color: #06b6d4;
          background: rgba(6, 182, 212, 0.05);
        }

        .upload-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1rem;
          border-radius: 16px;
          background: rgba(6, 182, 212, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #06b6d4;
        }

        .upload-text {
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        .upload-hint {
          color: #64748b;
          font-size: 0.875rem;
        }

        input[type="file"] {
          display: none;
        }

        .shifts-list {
          display: grid;
          gap: 1.5rem;
        }

        .shift-card {
          background: #0f172a;
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid #334155;
          transition: all 0.3s;
        }

        .shift-card:hover {
          border-color: #475569;
        }

        .shift-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #334155;
        }

        .shift-date {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #06b6d4;
          font-weight: 500;
        }

        .date-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .date-input {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .date-input:disabled {
          cursor: default;
        }

        .day-of-week {
          color: #06b6d4;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .shift-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-icon {
          background: #334155;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: #475569;
          color: #e2e8f0;
        }

        .btn-save {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .btn-save:hover {
          background: rgba(34, 197, 94, 0.3);
        }

        .btn-delete {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .btn-delete:hover {
          background: rgba(239, 68, 68, 0.3);
        }

        .shift-section {
          margin-bottom: 1.5rem;
        }

        .shift-section:last-child {
          margin-bottom: 0;
        }

        h4 {
          color: #94a3b8;
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
        }

        .employee-select {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .checkbox-label input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .hours-grid {
          display: grid;
          gap: 0.75rem;
        }

        .hours-row {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: #1e293b;
          border-radius: 8px;
        }

        .expo-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #1e293b;
          border-radius: 8px;
        }

        .emp-name {
          font-weight: 500;
        }

        .hours-input {
          width: 80px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 0.5rem;
          color: #e2e8f0;
          text-align: center;
          font-size: 0.95rem;
        }

        .hours-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .hours-label {
          color: #64748b;
          font-size: 0.875rem;
        }

        .tip-amount {
          color: #22c55e;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .tips-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .tip-input-group label {
          display: block;
          color: #94a3b8;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .input-with-icon {
          position: relative;
        }

        .input-with-icon svg {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .input-with-icon input {
          width: 100%;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          color: #e2e8f0;
          font-size: 1rem;
        }

        .input-with-icon input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .total-tips {
          text-align: right;
          color: #06b6d4;
          font-size: 1.25rem;
          font-weight: 600;
          padding-top: 1rem;
          border-top: 1px solid #334155;
        }

        .employee-list {
          display: grid;
          gap: 1rem;
        }

        .employee-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #0f172a;
          border-radius: 10px;
          border: 1px solid #334155;
        }

        .employee-card-detailed {
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #334155;
          overflow: hidden;
          transition: all 0.3s;
        }

        .employee-card-detailed:hover {
          border-color: #475569;
        }

        .employee-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
        }

        .employee-card-body {
          padding: 0 1.5rem 1.5rem 1.5rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          border-top: 1px solid #1e293b;
          padding-top: 1.5rem;
        }

        .employee-actions {
          display: flex;
          gap: 0.5rem;
        }

        .employee-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .employee-field label {
          color: #94a3b8;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .field-input {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.75rem;
          color: #e2e8f0;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .field-input:focus {
          outline: none;
          border-color: #06b6d4;
          background: #0f172a;
        }

        .edit-name-input {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.5rem;
          color: #e2e8f0;
          font-size: 1rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          width: 250px;
        }

        .edit-name-input:focus {
          outline: none;
          border-color: #06b6d4;
        }

        .edit-role-select {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 0.25rem 0.5rem;
          color: #64748b;
          font-size: 0.875rem;
          text-transform: capitalize;
          cursor: pointer;
        }

        .employee-field-display {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem 0;
        }

        .field-label {
          color: #64748b;
          font-size: 0.875rem;
          font-weight: 500;
          min-width: 60px;
        }

        .field-value {
          color: #94a3b8;
          font-size: 0.875rem;
        }

        .employee-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .employee-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.25rem;
        }

        .employee-details h3 {
          color: #e2e8f0;
          font-size: 1rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .employee-role {
          color: #64748b;
          font-size: 0.875rem;
          text-transform: capitalize;
          margin-bottom: 0.5rem;
        }

        .employee-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 0.5rem;
        }

        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          color: #64748b;
          font-size: 0.8rem;
          background: #1e293b;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
        }

        .add-employee {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #334155;
        }

        .add-employee input, .add-employee select {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.75rem;
          color: #e2e8f0;
          font-size: 0.95rem;
        }

        .weekly-summary {
          display: grid;
          gap: 1rem;
        }

        .summary-card {
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #334155;
          overflow: hidden;
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
        }

        .summary-breakdown {
          padding: 0 1.5rem 1.5rem 1.5rem;
          border-top: 1px solid #1e293b;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
        }

        .breakdown-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #94a3b8;
          font-size: 0.95rem;
        }

        .breakdown-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }

        .breakdown-icon.cash {
          background: rgba(34, 197, 94, 0.1);
        }

        .breakdown-icon.credit {
          background: rgba(59, 130, 246, 0.1);
        }

        .breakdown-icon.fee-icon {
          background: rgba(239, 68, 68, 0.1);
        }

        .breakdown-value {
          color: #e2e8f0;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .breakdown-row.fee {
          opacity: 0.8;
        }

        .breakdown-row.fee .breakdown-label {
          color: #ef4444;
        }

        .fee-amount {
          color: #ef4444;
        }

        .breakdown-divider {
          height: 1px;
          background: #334155;
          margin: 0.5rem 0;
        }

        .breakdown-row.total {
          padding-top: 1rem;
        }

        .breakdown-row.total .breakdown-label {
          color: #e2e8f0;
          font-size: 1rem;
        }

        .total-amount {
          color: #22c55e;
          font-size: 1.5rem;
        }

        .summary-card.grand-total {
          background: rgba(6, 182, 212, 0.1);
          border-color: #06b6d4;
        }

        .summary-card.grand-total .summary-header {
          padding: 1.5rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #334155;
        }

        .summary-employee {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .summary-total {
          font-size: 1.75rem;
          font-weight: 300;
          color: #22c55e;
        }

        .week-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .week-selector button {
          background: #334155;
          border: none;
          color: #e2e8f0;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .week-selector button:hover {
          background: #475569;
        }

        .current-week-btn {
          background: rgba(6, 182, 212, 0.2) !important;
          color: #06b6d4 !important;
          font-weight: 600;
        }

        .weekly-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .day-card {
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #334155;
          overflow: hidden;
          transition: all 0.3s;
        }

        .day-card.has-data {
          border-color: #475569;
        }

        .day-card.editing {
          border-color: #06b6d4;
          box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #1e293b;
          border-bottom: 1px solid #334155;
        }

        .day-info {
          display: flex;
          flex-direction: column;
        }

        .day-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: #06b6d4;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .day-date {
          font-size: 0.875rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        .day-content {
          padding: 1rem;
          min-height: 200px;
        }

        .day-section {
          margin-bottom: 1rem;
        }

        .day-section:last-child {
          margin-bottom: 0;
        }

        .day-section h5 {
          color: #94a3b8;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .employee-select-compact {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .checkbox-label-compact {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .checkbox-label-compact input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .hours-input-compact {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: #1e293b;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }

        .hours-input-small {
          width: 60px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 0.375rem;
          color: #e2e8f0;
          text-align: center;
          font-size: 0.875rem;
        }

        .tips-compact {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .tip-input-small {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 0.5rem;
          color: #e2e8f0;
          font-size: 0.875rem;
        }

        .tip-input-small::placeholder {
          color: #64748b;
        }

        .no-data {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #475569;
          font-size: 0.875rem;
          font-style: italic;
        }

        .day-summary {
          margin-bottom: 1rem;
        }

        .summary-label {
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: #1e293b;
          border-radius: 6px;
          margin-bottom: 0.375rem;
          font-size: 0.875rem;
        }

        .summary-line span:first-child {
          font-weight: 500;
        }

        .summary-line span:nth-child(2) {
          color: #94a3b8;
          font-size: 0.8rem;
        }

        .tip-amt {
          color: #22c55e;
          font-weight: 600;
        }

        .day-total {
          text-align: right;
          color: #06b6d4;
          font-size: 1.25rem;
          font-weight: 600;
          padding-top: 0.75rem;
          border-top: 1px solid #334155;
          margin-top: 0.75rem;
        }

        .mapping-list {
          display: grid;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .mapping-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #334155;
          gap: 1rem;
        }

        .mapping-employee {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .role-selector {
          display: flex;
          gap: 0.75rem;
        }

        .role-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: #1e293b;
          border: 2px solid #334155;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .role-option:hover {
          border-color: #475569;
          background: #334155;
        }

        .role-option input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .role-option input[type="radio"]:checked ~ .role-label {
          color: #06b6d4;
        }

        .role-option:has(input[type="radio"]:checked) {
          border-color: #06b6d4;
          background: rgba(6, 182, 212, 0.1);
        }

        .role-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #94a3b8;
          font-weight: 500;
          font-size: 0.95rem;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn:disabled:hover {
          transform: none;
          box-shadow: none;
        }

        @media (max-width: 768px) {
          .app {
            padding: 1rem;
          }

          h1 {
            font-size: 2rem;
          }

          .dashboard {
            grid-template-columns: 1fr;
          }

          .tips-grid {
            grid-template-columns: 1fr;
          }

          .hours-row {
            grid-template-columns: 1fr;
          }

          .add-employee {
            grid-template-columns: 1fr;
          }

          .mapping-card {
            flex-direction: column;
            align-items: stretch;
          }

          .role-selector {
            width: 100%;
          }

          .role-option {
            flex: 1;
          }

          .employee-card-body {
            grid-template-columns: 1fr;
          }

          .edit-name-input {
            width: 100%;
          }

          .weekly-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header>
        <h1>Tip Pool Manager</h1>
        <p className="subtitle">Track shifts, calculate distributions, and manage weekly payouts</p>
      </header>

      <nav>
        <button 
          className={`nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          <TrendingUp size={18} />
          Dashboard
        </button>
        <button 
          className={`nav-btn ${activeView === 'shifts' ? 'active' : ''}`}
          onClick={() => setActiveView('shifts')}
        >
          <Calendar size={18} />
          Shifts
        </button>
        <button 
          className={`nav-btn ${activeView === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveView('employees')}
        >
          <Users size={18} />
          Employees
        </button>
        <button 
          className={`nav-btn ${activeView === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveView('summary')}
        >
          <DollarSign size={18} />
          Weekly Summary
        </button>
      </nav>

      {activeView === 'dashboard' && (
        <>
          <div className="dashboard">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <Calendar size={20} />
                </div>
                Shifts This Week
              </div>
              <div className="stat-value">{weekShifts.length}</div>
              <div className="stat-label">Week {selectedWeek}</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <DollarSign size={20} />
                </div>
                Total Tips
              </div>
              <div className="stat-value">
                ${weekShifts.reduce((sum, s) => sum + (parseFloat(s.cashTips) || 0) + ((parseFloat(s.creditTips) || 0) * 0.97), 0).toFixed(2)}
              </div>
              <div className="stat-label">Cash + Credit</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <Users size={20} />
                </div>
                Active Employees
              </div>
              <div className="stat-value">{employees.length}</div>
              <div className="stat-label">{employees.filter(e => e.role === 'bartender').length} Bartenders, {employees.filter(e => e.role === 'expo').length} Expo</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <TrendingUp size={20} />
                </div>
                Avg Per Shift
              </div>
              <div className="stat-value">
                ${weekShifts.length > 0 ? (weekShifts.reduce((sum, s) => sum + (parseFloat(s.cashTips) || 0) + ((parseFloat(s.creditTips) || 0) * 0.97), 0) / weekShifts.length).toFixed(2) : '0.00'}
              </div>
              <div className="stat-label">This week</div>
            </div>
          </div>

          <div className="content-section">
            <div className="section-header">
              <h2>Quick Actions</h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label htmlFor="csv-upload">
                <div className="btn">
                  <Upload size={18} />
                  Import Shifts (CSV)
                </div>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                />
              </label>
              <button className="btn btn-secondary" onClick={addManualShift}>
                <Plus size={18} />
                Add Manual Shift
              </button>
            </div>
          </div>
        </>
      )}

      {activeView === 'shifts' && (
        <div className="content-section">
          <div className="section-header">
            <h2>Weekly Shifts</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="week-selector">
                <button onClick={goToPreviousWeek}>← Previous</button>
                <button onClick={goToCurrentWeek} className="current-week-btn">Today</button>
                <button onClick={goToNextWeek}>Next →</button>
              </div>
              <label htmlFor="csv-upload-shifts">
                <div className="btn btn-secondary">
                  <Upload size={18} />
                  Import CSV
                </div>
                <input
                  id="csv-upload-shifts"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                />
              </label>
            </div>
          </div>

          <div className="weekly-grid">
            {getWeekDates(weekStartDate).map((date, index) => {
              const shift = shifts.find(s => s.date === date) || {
                id: `temp-${date}`,
                date: date,
                employeeIds: [],
                hours: {},
                cashTips: 0,
                creditTips: 0,
                week: getCurrentWeek(),
                expoIds: []
              };
              
              const isEditing = editingShift === shift.id;
              const bartenderEmployees = employees.filter(e => e.role === 'bartender');
              const expoEmployees = employees.filter(e => e.role === 'expo');
              const distribution = calculateShiftTips(shift);
              const hasData = shift.employeeIds.length > 0 || shift.expoIds?.length > 0 || parseFloat(shift.cashTips) > 0 || parseFloat(shift.creditTips) > 0;

              return (
                <div 
                  key={date} 
                  className={`day-card ${hasData ? 'has-data' : ''} ${isEditing ? 'editing' : ''}`}
                >
                  <div className="day-header">
                    <div className="day-info">
                      <div className="day-name">{getDayOfWeek(date)}</div>
                      <div className="day-date">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    {isEditing ? (
                      <button onClick={() => setEditingShift(null)} className="btn-icon btn-save">
                        <Save size={16} />
                      </button>
                    ) : (
                      <button onClick={() => {
                        if (!shifts.find(s => s.date === date)) {
                          const newShift = {
                            id: Date.now() + Math.random(),
                            date: date,
                            employeeIds: [],
                            hours: {},
                            cashTips: 0,
                            creditTips: 0,
                            week: getCurrentWeek(),
                            expoIds: []
                          };
                          setShifts(prev => [...prev, newShift]);
                          setEditingShift(newShift.id);
                        } else {
                          setEditingShift(shift.id);
                        }
                      }} className="btn-icon">
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="day-content">
                    {isEditing ? (
                      <>
                        <div className="day-section">
                          <h5>Bartenders</h5>
                          <div className="employee-select-compact">
                            {bartenderEmployees.map(emp => (
                              <label key={emp.id} className="checkbox-label-compact">
                                <input
                                  type="checkbox"
                                  checked={shift.employeeIds?.includes(emp.id)}
                                  onChange={(e) => {
                                    const currentShift = shifts.find(s => s.date === date) || shift;
                                    const newIds = e.target.checked
                                      ? [...(currentShift.employeeIds || []), emp.id]
                                      : (currentShift.employeeIds || []).filter(id => id !== emp.id);
                                    
                                    if (shifts.find(s => s.date === date)) {
                                      updateShift(currentShift.id, { employeeIds: newIds });
                                    } else {
                                      const newShift = { ...currentShift, employeeIds: newIds };
                                      setShifts(prev => [...prev, newShift]);
                                    }
                                  }}
                                />
                                <span style={{ color: emp.color }}>{emp.name.split(' ')[0]}</span>
                              </label>
                            ))}
                          </div>
                          
                          {shift.employeeIds?.map(empId => {
                            const emp = employees.find(e => e.id === empId);
                            if (!emp) return null;
                            
                            return (
                              <div key={empId} className="hours-input-compact">
                                <span style={{ color: emp.color, fontSize: '0.85rem' }}>{emp.name.split(' ')[0]}</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={shift.hours?.[empId] || ''}
                                  onChange={(e) => {
                                    const currentShift = shifts.find(s => s.date === date);
                                    if (currentShift) {
                                      updateShift(currentShift.id, { 
                                        hours: { ...currentShift.hours, [empId]: e.target.value }
                                      });
                                    }
                                  }}
                                  className="hours-input-small"
                                  placeholder="hrs"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {expoEmployees.length > 0 && (
                          <div className="day-section">
                            <h5>Expo</h5>
                            <div className="employee-select-compact">
                              {expoEmployees.map(emp => (
                                <label key={emp.id} className="checkbox-label-compact">
                                  <input
                                    type="checkbox"
                                    checked={shift.expoIds?.includes(emp.id)}
                                    onChange={(e) => {
                                      const currentShift = shifts.find(s => s.date === date) || shift;
                                      const newIds = e.target.checked
                                        ? [...(currentShift.expoIds || []), emp.id]
                                        : (currentShift.expoIds || []).filter(id => id !== emp.id);
                                      
                                      if (shifts.find(s => s.date === date)) {
                                        updateShift(currentShift.id, { expoIds: newIds });
                                      } else {
                                        const newShift = { ...currentShift, expoIds: newIds };
                                        setShifts(prev => [...prev, newShift]);
                                      }
                                    }}
                                  />
                                  <span style={{ color: emp.color }}>{emp.name.split(' ')[0]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="day-section">
                          <h5>Tips</h5>
                          <div className="tips-compact">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={shift.cashTips || ''}
                              onChange={(e) => {
                                const currentShift = shifts.find(s => s.date === date);
                                if (currentShift) {
                                  updateShift(currentShift.id, { cashTips: e.target.value });
                                } else {
                                  const newShift = { ...shift, cashTips: e.target.value };
                                  setShifts(prev => [...prev, newShift]);
                                }
                              }}
                              placeholder="Cash"
                              className="tip-input-small"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={shift.creditTips || ''}
                              onChange={(e) => {
                                const currentShift = shifts.find(s => s.date === date);
                                if (currentShift) {
                                  updateShift(currentShift.id, { creditTips: e.target.value });
                                } else {
                                  const newShift = { ...shift, creditTips: e.target.value };
                                  setShifts(prev => [...prev, newShift]);
                                }
                              }}
                              placeholder="Credit"
                              className="tip-input-small"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {!hasData ? (
                          <div className="no-data">
                            <span>No shift data</span>
                          </div>
                        ) : (
                          <>
                            {shift.employeeIds?.length > 0 && (
                              <div className="day-summary">
                                <div className="summary-label">Bartenders</div>
                                {shift.employeeIds.map(empId => {
                                  const emp = employees.find(e => e.id === empId);
                                  if (!emp) return null;
                                  return (
                                    <div key={empId} className="summary-line">
                                      <span style={{ color: emp.color }}>{emp.name.split(' ')[0]}</span>
                                      <span>{shift.hours?.[empId] || 0}h</span>
                                      <span className="tip-amt">${(distribution[empId] || 0).toFixed(2)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {shift.expoIds?.length > 0 && (
                              <div className="day-summary">
                                <div className="summary-label">Expo</div>
                                {shift.expoIds.map(empId => {
                                  const emp = employees.find(e => e.id === empId);
                                  if (!emp) return null;
                                  return (
                                    <div key={empId} className="summary-line">
                                      <span style={{ color: emp.color }}>{emp.name.split(' ')[0]}</span>
                                      <span className="tip-amt">${(distribution[empId] || 0).toFixed(2)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="day-total">
                              ${((parseFloat(shift.cashTips) || 0) + ((parseFloat(shift.creditTips) || 0) * 0.97)).toFixed(2)}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeView === 'employees' && (
        <div className="content-section">
          <div className="section-header">
            <h2>Manage Employees</h2>
          </div>

          <div className="add-employee">
            <input
              type="text"
              placeholder="Employee name"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
            />
            <select
              value={newEmployee.role}
              onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
            >
              <option value="bartender">Bartender</option>
              <option value="expo">Expo</option>
            </select>
            <button className="btn" onClick={addEmployee}>
              <Plus size={18} />
              Add
            </button>
          </div>

          <div className="employee-list">
            {employees.map(emp => {
              const isEditing = editingEmployee === emp.id;
              
              return (
                <div key={emp.id} className="employee-card-detailed">
                  <div className="employee-card-header">
                    <div className="employee-info">
                      <div className="employee-avatar" style={{ background: emp.color + '20', color: emp.color }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div className="employee-details">
                        {isEditing ? (
                          <input
                            type="text"
                            value={emp.name}
                            onChange={(e) => updateEmployee(emp.id, { name: e.target.value })}
                            className="edit-name-input"
                            placeholder="Employee name"
                          />
                        ) : (
                          <h3>{emp.name}</h3>
                        )}
                        {isEditing ? (
                          <select
                            value={emp.role}
                            onChange={(e) => updateEmployee(emp.id, { role: e.target.value })}
                            className="edit-role-select"
                          >
                            <option value="bartender">Bartender</option>
                            <option value="expo">Expo</option>
                          </select>
                        ) : (
                          <div className="employee-role">{emp.role}</div>
                        )}
                      </div>
                    </div>
                    <div className="employee-actions">
                      {isEditing ? (
                        <button className="btn-icon btn-save" onClick={() => setEditingEmployee(null)}>
                          <Save size={18} />
                        </button>
                      ) : (
                        <button className="btn-icon" onClick={() => setEditingEmployee(emp.id)}>
                          <Edit2 size={18} />
                        </button>
                      )}
                      <button className="btn-icon btn-delete" onClick={() => deleteEmployee(emp.id)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  {isEditing && (
                    <div className="employee-card-body">
                      <div className="employee-field">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          value={emp.phone || ''}
                          onChange={(e) => updateEmployee(emp.id, { phone: e.target.value })}
                          placeholder="(555) 123-4567"
                          className="field-input"
                        />
                      </div>
                      <div className="employee-field">
                        <label>Teller Account</label>
                        <input
                          type="text"
                          value={emp.tellerAccount || ''}
                          onChange={(e) => updateEmployee(emp.id, { tellerAccount: e.target.value })}
                          placeholder="@username or account number"
                          className="field-input"
                        />
                      </div>
                    </div>
                  )}
                  
                  {!isEditing && (emp.phone || emp.tellerAccount) && (
                    <div className="employee-card-body">
                      {emp.phone && (
                        <div className="employee-field-display">
                          <span className="field-label">Phone:</span>
                          <span className="field-value">{emp.phone}</span>
                        </div>
                      )}
                      {emp.tellerAccount && (
                        <div className="employee-field-display">
                          <span className="field-label">Teller:</span>
                          <span className="field-value">{emp.tellerAccount}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeView === 'summary' && (
        <div className="content-section">
          <div className="section-header">
            <h2>Weekly Summary</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="week-selector">
                <button onClick={() => setSelectedWeek(selectedWeek - 1)}>← Previous</button>
                <span style={{ color: '#94a3b8', fontWeight: 500 }}>Week {selectedWeek}</span>
                <button onClick={() => setSelectedWeek(selectedWeek + 1)}>Next →</button>
              </div>
              {employees.filter(emp => weeklyBreakdown[emp.id]?.shifts > 0).length > 0 && (
                <button className="btn" onClick={exportWeeklySummaryPDF}>
                  <Download size={18} />
                  Export PDF
                </button>
              )}
            </div>
          </div>

          <div className="weekly-summary">
            {employees
              .filter(emp => {
                const details = weeklyBreakdown[emp.id];
                return details && details.shifts > 0;
              })
              .map(emp => {
                const details = weeklyBreakdown[emp.id];
                const total = details.cashTips + details.creditTips;

                return (
                  <div key={emp.id} className="summary-card">
                    <div className="summary-header">
                      <div className="summary-employee">
                        <div className="employee-avatar" style={{ background: emp.color + '20', color: emp.color }}>
                          {emp.name.charAt(0)}
                        </div>
                        <div className="employee-details">
                          <h3>{emp.name}</h3>
                          <div className="employee-role">
                            {emp.role} • {details.shifts} shift{details.shifts !== 1 ? 's' : ''}
                          </div>
                          <div className="employee-meta">
                            <span className="meta-item">
                              📅 {formatDaysWorked(details.daysWorked)}
                            </span>
                            {details.totalHours > 0 && (
                              <span className="meta-item">
                                ⏱️ {details.totalHours.toFixed(1)} hrs
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="summary-total">
                        ${total.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="summary-breakdown">
                      <div className="breakdown-row">
                        <div className="breakdown-label">
                          <div className="breakdown-icon cash">💵</div>
                          Cash Tips
                        </div>
                        <div className="breakdown-value">${details.cashTips.toFixed(2)}</div>
                      </div>
                      
                      <div className="breakdown-row">
                        <div className="breakdown-label">
                          <div className="breakdown-icon credit">💳</div>
                          Credit Tips
                        </div>
                        <div className="breakdown-value">${details.creditTips.toFixed(2)}</div>
                      </div>
                      
                      {details.creditFee > 0 && (
                        <div className="breakdown-row fee">
                          <div className="breakdown-label">
                            <div className="breakdown-icon fee-icon">⚠️</div>
                            Credit Card Fee (3%)
                          </div>
                          <div className="breakdown-value fee-amount">-${details.creditFee.toFixed(2)}</div>
                        </div>
                      )}
                      
                      <div className="breakdown-divider"></div>
                      
                      <div className="breakdown-row total">
                        <div className="breakdown-label">
                          <strong>Total to Receive</strong>
                        </div>
                        <div className="breakdown-value total-amount">${total.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

            {employees.filter(emp => weeklyBreakdown[emp.id]?.shifts > 0).length === 0 && (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                No shifts recorded for this week
              </p>
            )}

            {employees.filter(emp => weeklyBreakdown[emp.id]?.shifts > 0).length > 0 && (
              <div className="summary-card grand-total">
                <div className="summary-header">
                  <div className="summary-employee">
                    <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '1.1rem' }}>GRAND TOTAL</div>
                  </div>
                  <div className="summary-total" style={{ color: '#06b6d4', fontSize: '2rem' }}>
                    ${employees
                      .filter(emp => weeklyBreakdown[emp.id]?.shifts > 0)
                      .reduce((sum, emp) => {
                        const details = weeklyBreakdown[emp.id];
                        return sum + details.cashTips + details.creditTips;
                      }, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'import-mapping' && importedData && (
        <div className="content-section">
          <div className="section-header">
            <h2>Map Employee Roles</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              Assign each imported employee as either a Bartender or Expo worker
            </p>
          </div>

          <div className="mapping-list">
            {importedData.employees.map(empName => (
              <div key={empName} className="mapping-card">
                <div className="mapping-employee">
                  <div className="employee-avatar" style={{ 
                    background: 'rgba(6, 182, 212, 0.2)', 
                    color: '#06b6d4' 
                  }}>
                    {empName.charAt(0)}
                  </div>
                  <div className="employee-details">
                    <h3>{empName}</h3>
                    <div className="employee-role" style={{ color: '#64748b' }}>
                      {importedData.shifts[empName]?.length || 0} shifts found
                    </div>
                  </div>
                </div>
                <div className="role-selector">
                  <label className="role-option">
                    <input
                      type="radio"
                      name={`role-${empName}`}
                      value="bartender"
                      checked={employeeMapping[empName] === 'bartender'}
                      onChange={(e) => setEmployeeMapping(prev => ({
                        ...prev,
                        [empName]: 'bartender'
                      }))}
                    />
                    <span className="role-label">
                      <Users size={16} />
                      Bartender
                    </span>
                  </label>
                  <label className="role-option">
                    <input
                      type="radio"
                      name={`role-${empName}`}
                      value="expo"
                      checked={employeeMapping[empName] === 'expo'}
                      onChange={(e) => setEmployeeMapping(prev => ({
                        ...prev,
                        [empName]: 'expo'
                      }))}
                    />
                    <span className="role-label">
                      <DollarSign size={16} />
                      Expo
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setImportedData(null);
                setEmployeeMapping({});
                setActiveView('shifts');
              }}
            >
              Cancel
            </button>
            <button 
              className="btn"
              onClick={completeImport}
              disabled={Object.keys(employeeMapping).length !== importedData.employees.length}
            >
              <Upload size={18} />
              Import {importedData.employees.length} Employees & Shifts
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TipPoolManagementSystem;
