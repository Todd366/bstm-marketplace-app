/**
 * BSTM Voice Search System
 * Web Speech API integration
 */

const VoiceSearch = {
    recognition: null,
    isListening: false,
    
    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech recognition not supported');
            return false;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-BW'; // Botswana English
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.handleVoiceInput(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stopListening();
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI(false);
        };
        
        return true;
    },
    
    startListening() {
        if (!this.recognition) {
            if (!this.init()) {
                alert('Voice search not supported on this device');
                return;
            }
        }
        
        try {
            this.recognition.start();
            this.isListening = true;
            this.updateUI(true);
            
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        } catch (error) {
            console.error('Error starting voice search:', error);
        }
    },
    
    stopListening() {
        if (this.recognition) {
            this.recognition.stop();
            this.isListening = false;
            this.updateUI(false);
        }
    },
    
    handleVoiceInput(transcript) {
        console.log('Voice input:', transcript);
        
        // Update search input
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Search"]');
        searchInputs.forEach(input => {
            input.value = transcript;
            
            // Trigger search
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        });
        
        // Show confirmation
        this.showConfirmation(transcript);
    },
    
    updateUI(listening) {
        const voiceButtons = document.querySelectorAll('.voice-search-btn');
        voiceButtons.forEach(btn => {
            if (listening) {
                btn.classList.add('listening');
                btn.innerHTML = '<i class="fas fa-stop-circle animate-pulse"></i>';
            } else {
                btn.classList.remove('listening');
                btn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        });
    },
    
    showConfirmation(text) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50';
        toast.innerHTML = `
            <i class="fas fa-microphone mr-2"></i>
            Searching for: "${text}"
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
};

// Add voice search buttons to search inputs
document.addEventListener('DOMContentLoaded', () => {
    const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Search"]');
    
    searchInputs.forEach(input => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';
        
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        
        const voiceBtn = document.createElement('button');
        voiceBtn.className = 'voice-search-btn absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-600 hover:text-purple-800';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.onclick = (e) => {
            e.preventDefault();
            VoiceSearch.startListening();
        };
        
        wrapper.appendChild(voiceBtn);
    });
});

window.VoiceSearch = VoiceSearch;
