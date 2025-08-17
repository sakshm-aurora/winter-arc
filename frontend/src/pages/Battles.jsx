import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BattleSelector } from '../components/RPG/BattleArena';
import { EnhancedBattleArena } from '../components/RPG/EnhancedBattleArena';

export default function Battles() {
  const { api, user } = useAuth();
  const [battles, setBattles] = useState([]);
  const [selectedBattle, setSelectedBattle] = useState(null);
  const [logs, setLogs] = useState([]);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingCheckins, setSubmittingCheckins] = useState(false);

  useEffect(() => {
    fetchBattles();
  }, [api]);

  const fetchBattles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/battles');
      setBattles(res.data);
      
      // Auto-select first battle if available
      if (res.data.length > 0 && !selectedBattle) {
        await selectBattle(res.data[0]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching battles');
    } finally {
      setLoading(false);
    }
  };

  const selectBattle = async (battle) => {
    try {
      setSelectedBattle(battle);
      
      // Fetch logs and available quests in parallel
      const [logRes, questRes] = await Promise.all([
        api.get(`/battles/${battle.id}/logs`),
        api.get('/quests/available')
      ]);
      
      setLogs(logRes.data);
      // Extract just the available quests from the response
      setQuests(questRes.data.available_quests || []);
    } catch (err) {
      console.error('Error selecting battle:', err);
      setError('Error loading battle details');
    }
  };

  const handleSubmitCheckins = async (checkinResults) => {
    if (!selectedBattle) return;
    
    try {
      setSubmittingCheckins(true);
      
      await api.post('/checkins', {
        battle_id: selectedBattle.id,
        results: checkinResults,
      });
      
      // Refresh battle data and logs
      await Promise.all([
        fetchBattles(),
        selectBattle(selectedBattle)
      ]);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting checkins');
      throw err; // Re-throw to let the component handle it
    } finally {
      setSubmittingCheckins(false);
    }
  };

  if (loading && battles.length === 0) {
    return (
      <div className="rpg-container">
        <div className="aurora-bg" />
        <div className="loading-screen">
          <div className="loading-content">
            <h1 className="neon-text">❄️ Loading Winter Arena... ⚔️</h1>
            <div className="loading-spinner-rpg">
              <span>🌨️</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && battles.length === 0) {
    return (
      <div className="rpg-container">
        <div className="aurora-bg" />
        <div className="error-screen">
          <div className="error-content">
            <h1 className="neon-text">❌ Battle Arena Error</h1>
            <p className="error-message">{error}</p>
            <button 
              className="rpg-button"
              onClick={() => {
                setError('');
                fetchBattles();
              }}
            >
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If no battle is selected, show battle selector
  if (!selectedBattle) {
    return (
      <div className="rpg-container">
        <div className="aurora-bg" />
        <div className="battle-selection-screen">
          <BattleSelector
            battles={battles}
            currentUser={user}
            onSelectBattle={selectBattle}
            selectedBattleId={null}
          />
          
          {error && (
            <div className="error-toast">
              <span className="error-text">⚠️ {error}</span>
              <button 
                className="error-close"
                onClick={() => setError('')}
              >
                ❌
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main battle arena view
  return (
    <div className="battles-page">
      <EnhancedBattleArena
        battle={selectedBattle}
                      currentUser={user}
              logs={logs}
              quests={quests}
              onSubmitCheckins={handleSubmitCheckins}
              isLoading={submittingCheckins}
              userStats={{}}
              battleStats={{ currentBattle: selectedBattle, activeBattles: 1 }}
            />
      
      {/* Battle Selector Toggle for Mobile */}
      <div className="battle-selector-toggle">
        <button 
          className="rpg-button"
          onClick={() => setSelectedBattle(null)}
        >
          📋 Switch Battle
        </button>
      </div>
      
      {/* Error Toast */}
      {error && (
        <div className="error-toast">
          <span className="error-text">⚠️ {error}</span>
          <button 
            className="error-close"
            onClick={() => setError('')}
          >
            ❌
          </button>
        </div>
      )}
    </div>
  );
}