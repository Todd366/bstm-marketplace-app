const InfiniteScroll = {
    page: 1,
    loading: false,
    hasMore: true,
    
    init(loadMoreCallback) {
        window.addEventListener('scroll', () => {
            if (this.loading || !this.hasMore) return;
            
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.documentElement.scrollHeight - 500;
            
            if (scrollPosition >= threshold) {
                this.loading = true;
                loadMoreCallback(this.page++);
            }
        });
    }
};
