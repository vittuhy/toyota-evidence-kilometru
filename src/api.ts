export interface MileageRecord {
  id: number;
  date: string;
  totalKm: number;
  createdAt: string;
  source: 'manual' | 'API'; // Source of the record
}

export interface CreateRecordData {
  date: string;
  totalKm: number;
  source?: 'manual' | 'API';
}

export interface UpdateRecordData {
  date: string;
  totalKm: number;
  source?: 'manual' | 'API';
}

class ApiService {
  private isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  private API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // For localhost, use localStorage instead of API calls
    if (this.isLocalhost) {
      throw new Error('Local development mode - using localStorage');
    }

    const url = `${this.API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    // Special handling for DELETE 204 No Content
    if (options?.method === 'DELETE' && response.status === 204) {
      // @ts-expect-error: void return
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Get all records
  async getRecords(): Promise<MileageRecord[]> {
    if (this.isLocalhost) {
      // Always return demo data for local development
      return [
        { id: 1, date: '2025-07-11', totalKm: 100, createdAt: '2025-07-11T10:00:00Z', source: 'manual' },
        { id: 2, date: '2025-07-31', totalKm: 300, createdAt: '2025-07-31T10:00:00Z', source: 'manual' },
        { id: 3, date: '2025-08-15', totalKm: 750, createdAt: '2025-08-15T10:00:00Z', source: 'manual' },
        { id: 4, date: '2025-09-30', totalKm: 2200, createdAt: '2025-09-30T10:00:00Z', source: 'manual' },
        { id: 5, date: '2025-10-31', totalKm: 4200, createdAt: '2025-10-31T10:00:00Z', source: 'manual' }
      ];
    }
    const records = await this.request<MileageRecord[]>('/records');
    // Ensure all records have source set to 'manual' if missing
    return records.map(record => ({
      ...record,
      source: record.source || 'manual'
    }));
  }

  // Create new record
  async createRecord(data: CreateRecordData): Promise<MileageRecord> {
    if (this.isLocalhost) {
      const savedRecords = localStorage.getItem('mileageRecords');
      const records = savedRecords ? JSON.parse(savedRecords) : [];
      const newRecord = {
        id: Date.now(),
        date: data.date,
        totalKm: data.totalKm,
        createdAt: new Date().toISOString(),
        source: data.source || 'manual',
      };
      const updatedRecords = [...records, newRecord];
      localStorage.setItem('mileageRecords', JSON.stringify(updatedRecords));
      return newRecord;
    }
    return this.request<MileageRecord>('/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Update record
  async updateRecord(id: number, data: UpdateRecordData): Promise<MileageRecord> {
    if (this.isLocalhost) {
      const savedRecords = localStorage.getItem('mileageRecords');
      const records = savedRecords ? JSON.parse(savedRecords) : [];
      const updatedRecords = records.map((record: MileageRecord) => 
        record.id === id 
          ? { ...record, date: data.date, totalKm: data.totalKm, createdAt: new Date().toISOString(), source: data.source || record.source || 'manual' }
          : record
      );
      localStorage.setItem('mileageRecords', JSON.stringify(updatedRecords));
      return updatedRecords.find((r: MileageRecord) => r.id === id)!;
    }
    return this.request<MileageRecord>(`/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Fetch mileage from Toyota API
  async fetchMileageFromAPI(): Promise<{ success: boolean; mileage?: number; error?: string; vehicle?: string }> {
    if (this.isLocalhost) {
      // For localhost, try to call the actual API endpoint
      // This will work if you run 'netlify dev' or have the function running locally
      try {
        const response = await fetch('http://localhost:8888/.netlify/functions/fetch-mileage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          return await response.json();
        } else {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            error: errorData.error || `HTTP ${response.status}`
          };
        }
      } catch (error) {
        // Fallback to mock data if function not available
        console.warn('Local API function not available, using mock data:', error);
        return {
          success: true,
          mileage: 8007,
          vehicle: '2023 Toyota Corolla HB/TS - MC \'23'
        };
      }
    }
    // In production, use the redirect path from netlify.toml
    const url = '/api/fetch-mileage';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`
      };
    }

    return response.json();
  }

  // Delete record
  async deleteRecord(id: number): Promise<void> {
    if (this.isLocalhost) {
      const savedRecords = localStorage.getItem('mileageRecords');
      const records = savedRecords ? JSON.parse(savedRecords) : [];
      const updatedRecords = records.filter((record: MileageRecord) => record.id !== id);
      localStorage.setItem('mileageRecords', JSON.stringify(updatedRecords));
      return;
    }
    return this.request<void>(`/records/${id}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    if (this.isLocalhost) {
      return { status: 'OK', timestamp: new Date().toISOString() };
    }
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

export const apiService = new ApiService(); 