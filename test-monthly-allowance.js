// Test script for monthly allowance calculation
const LEASE_START = '2025-07-08';
const leaseStartDate = new Date(LEASE_START);

function getMonthlyAllowance(year, month, leaseStartDate) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // Last day of month
  
  // If this is the lease start month, start from lease start date
  const startDate = (year === leaseStartDate.getFullYear() && month === leaseStartDate.getMonth()) 
    ? leaseStartDate 
    : monthStart;
  
  const daysInMonth = Math.ceil((monthEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.round(daysInMonth * (20000 / 365)); // 20,000 km / 365 days = 54.79 km/day
}

// Test different months
console.log('Monthly Allowance Test:');
console.log('=======================');

// July 2025 (lease start month - starts on 8th)
const julyAllowance = getMonthlyAllowance(2025, 6, leaseStartDate); // month is 0-indexed
console.log(`July 2025 (8th-31st): ${julyAllowance} km (${julyAllowance/(20000/365)} days)`);

// August 2025 (full month)
const augustAllowance = getMonthlyAllowance(2025, 7, leaseStartDate);
console.log(`August 2025 (1st-31st): ${augustAllowance} km (${augustAllowance/(20000/365)} days)`);

// September 2025 (30 days)
const septemberAllowance = getMonthlyAllowance(2025, 8, leaseStartDate);
console.log(`September 2025 (1st-30th): ${septemberAllowance} km (${septemberAllowance/(20000/365)} days)`);

// February 2026 (28 days, not leap year)
const febAllowance = getMonthlyAllowance(2026, 1, leaseStartDate);
console.log(`February 2026 (1st-28th): ${febAllowance} km (${febAllowance/(20000/365)} days)`);

// December 2025 (31 days)
const decAllowance = getMonthlyAllowance(2025, 11, leaseStartDate);
console.log(`December 2025 (1st-31st): ${decAllowance} km (${decAllowance/(20000/365)} days)`);

console.log('\nExpected vs Old Fixed Limit:');
console.log('============================');
console.log(`Old fixed limit: 1,665 km`);
console.log(`July 2025: ${julyAllowance} km (${julyAllowance > 1665 ? 'higher' : 'lower'} than fixed)`);
console.log(`August 2025: ${augustAllowance} km (${augustAllowance > 1665 ? 'higher' : 'lower'} than fixed)`);
console.log(`September 2025: ${septemberAllowance} km (${septemberAllowance > 1665 ? 'higher' : 'lower'} than fixed)`);
