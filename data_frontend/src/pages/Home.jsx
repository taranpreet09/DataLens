import { Link } from 'react-router-dom';
import { motion } from "framer-motion";
import NeonParticleCanvas from "../components/NeonParticleCanvas";

export default function Home() {



  const fadeUpVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div className="font-body selection:bg-primary/30 selection:text-primary overflow-x-hidden bg-[#0e0e0e] text-white min-h-screen relative">
      {/* Global Fixed Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background/80 to-background pointer-events-none"></div>
        <NeonParticleCanvas
          particleCount={100}
          interactive={true}
          gridEnabled={true}
          barsEnabled={false}
          alwaysActive={true}
          className="absolute inset-0 h-full w-full opacity-100 mix-blend-screen"
        />
      </div>
      
      {/* TopNavBar */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 w-full z-50 no-border bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e]/80 to-transparent backdrop-blur-sm"
      >
        <div className="flex justify-between items-center px-4 md:px-8 py-6 max-w-screen-2xl mx-auto">
          <div className="text-xl font-bold tracking-tighter text-slate-50 font-headline">
            DataLens
          </div>
          <div className="hidden md:flex items-center gap-10">
            <Link className="text-blue-400 font-semibold border-b-2 border-blue-500 pb-1 font-headline text-sm tracking-tight" to="/">Platform</Link>
            <Link className="text-slate-400 hover:text-slate-200 transition-colors font-headline text-sm tracking-tight" to="#">Solutions</Link>
            <Link className="text-slate-400 hover:text-slate-200 transition-colors font-headline text-sm tracking-tight" to="#">Network</Link>
            <Link className="text-slate-400 hover:text-slate-200 transition-colors font-headline text-sm tracking-tight" to="#">Intelligence</Link>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-slate-400 hover:text-slate-200 transition-colors font-headline text-sm tracking-tight">Sign In</Link>
            <Link to="/signup" className="bg-primary hover:bg-primary-fixed-dim text-on-primary px-6 py-2.5 rounded-lg font-headline text-sm font-semibold transition-all duration-300 scale-95 active:scale-90 inline-block">
              Get Started
            </Link>
          </div>
        </div>
      </motion.nav>
      
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="relative z-10 text-center px-6 max-w-5xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-outline-variant bg-surface-container-low/50 backdrop-blur-md mb-8">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_10px_#5cfd80]"></span>
              <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">DataLens Ingestion Engine Active</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-headline font-extrabold tracking-tighter leading-tight mb-8">
              Scale Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-tertiary to-secondary">Intelligence</span>
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant font-body max-w-2xl mx-auto mb-12 leading-relaxed">
              DataLens is the engine for hyper-scale data operations. Upload your raw signals and transform them into architectural clarity with our advanced processing core.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/dashboard" className="w-full sm:w-auto px-10 py-4 bg-primary text-on-primary rounded-xl font-headline font-bold text-lg hover:shadow-[0_0_30px_rgba(148,170,255,0.4)] transition-all flex items-center justify-center gap-3">
                <span className="material-symbols-outlined">upload_file</span>
                Upload Your Dataset
              </Link>
              <Link to="/dashboard" className="w-full sm:w-auto px-10 py-4 border border-outline-variant bg-surface-container-high/50 backdrop-blur-md rounded-xl font-headline font-bold text-lg hover:bg-surface-container-highest transition-all inline-block">
                Analyze Excel/CSV
              </Link>
            </div>
            <div className="mt-8 flex items-center justify-center gap-6 text-on-surface-variant/60 font-label text-xs uppercase tracking-[0.2em]">
              <span>Supports: .CSV</span>
              <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
              <span>.XLSX</span>
              <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
              <span>.JSON</span>
            </div>
          </motion.div>
        </section>

        {/* Data Ingestion (New Section) */}
        <section className="py-32 relative overflow-hidden">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUpVariant}
              className="order-2 lg:order-1"
            >
              <div className="dashed-border p-1 bg-surface-container-high/20">
                <div className="glass-panel rounded-3xl p-6 md:p-12 border border-outline-variant/30 flex flex-col items-center justify-center min-h-[400px] text-center group transition-all duration-500 hover:shadow-[0_0_40px_rgba(148,170,255,0.1)]">
                  <div className="w-20 h-20 rounded-full bg-primary-container/10 flex items-center justify-center mb-8 border border-primary/20 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
                    <span className="material-symbols-outlined text-4xl text-primary">cloud_upload</span>
                  </div>
                  <h3 className="text-3xl font-headline font-bold mb-4">Instant Data Ingestion</h3>
                  <p className="text-on-surface-variant max-w-sm mb-10 leading-relaxed">Drag your .csv or .xlsx files here to initialize the architectural mapping sequence.</p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="px-4 py-2 bg-surface-container rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface-variant shadow-lg group-hover:-translate-y-1 transition-transform">Sales_Q4.csv</div>
                    <div className="px-4 py-2 bg-surface-container rounded-lg border border-outline-variant/30 text-xs font-mono text-on-surface-variant shadow-lg group-hover:-translate-y-1 transition-transform delay-75">Inventory_Master.xlsx</div>
                  </div>
                  <div className="mt-12 w-full max-w-xs h-1 bg-outline-variant/20 rounded-full overflow-hidden">
                    <div className="w-0 group-hover:w-full h-full bg-primary transition-all duration-[2000ms] ease-out"></div>
                  </div>
                  <div className="mt-4 text-[10px] font-label text-on-surface-variant uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Streaming to Core...</div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeUpVariant}
              className="order-1 lg:order-2 space-y-8"
            >
              <span className="text-secondary font-label text-xs tracking-widest uppercase block">The Intake Layer</span>
              <h2 className="text-4xl md:text-6xl font-headline font-extrabold tracking-tighter leading-tight">Zero-Config Data Analysis</h2>
              <p className="text-on-surface-variant text-lg leading-relaxed">Stop wrestling with schema definitions. DataLens automatically detects types, relationships, and anomalies in your Excel and CSV files the moment they touch our servers.</p>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div className="text-sm">
                    <strong className="text-on-surface block mb-1">Deep Field Mapping</strong>
                    Automated column recognition for complex financial datasets.
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div className="text-sm">
                    <strong className="text-on-surface block mb-1">Legacy Support</strong>
                    Seamlessly handles older .xls formats and malformed .csv structures.
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <div className="text-sm">
                    <strong className="text-on-surface block mb-1">Sub-second Parsing</strong>
                    100MB files processed in under 400ms for immediate exploration.
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>
        </section>

        {/* Bento Grid: The Data Galaxy Map */}
        <section className="py-32 px-4 md:px-8 max-w-screen-2xl mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUpVariant}
            className="mb-20 text-center"
          >
            <h2 className="text-4xl md:text-5xl font-headline font-bold mb-4 tracking-tight">The Data Galaxy Map</h2>
            <p className="text-on-surface-variant max-w-xl mx-auto">Once uploaded, navigate your raw files as infinite clusters with spatial precision.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[800px]">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="md:col-span-8 group relative overflow-hidden rounded-3xl bg-surface-container-low p-10 flex flex-col justify-end border border-outline-variant/10 shadow-2xl"
            >
              <div className="absolute inset-0 z-0 overflow-hidden mix-blend-screen opacity-60 group-hover:opacity-100 transition-opacity duration-1000">
                <NeonParticleCanvas
                  particleCount={45}
                  interactive={false}
                  gridEnabled={false}
                  barsEnabled={false}
                  alwaysActive={false}
                  className="absolute inset-0 w-full h-full"
                />
                {/* Bottom fade */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent pointer-events-none"></div>
              </div>
              <div className="relative z-10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <span className="text-primary font-label text-xs tracking-widest uppercase mb-4 block">Visual Interface</span>
                <h3 className="text-3xl font-headline font-bold mb-4">Deep Cluster Mapping</h3>
                <p className="text-on-surface-variant max-w-md">Real-time visualization of petabyte-scale datasets using our proprietary gravitational sorting algorithm.</p>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="md:col-span-4 rounded-3xl bg-surface-container-high p-8 flex flex-col justify-between border border-outline-variant/20 hover:border-primary/50 transition-all cursor-pointer group"
            >
              <div>
                <span className="material-symbols-outlined text-4xl text-tertiary mb-6 group-hover:scale-110 transition-transform">dynamic_form</span>
                <h3 className="text-2xl font-headline font-bold mb-3">DataLens Explorer</h3>
                <p className="text-on-surface-variant text-sm">Query across dimensions without the bottleneck of traditional relational structures.</p>
              </div>
              <div className="pt-8 mt-8 border-t border-outline-variant/10">
                <div className="flex items-center justify-between text-xs font-label text-on-surface-variant uppercase tracking-tighter">
                  <span>Latent Speed</span>
                  <span className="text-tertiary font-bold tracking-widest">0.002ms</span>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="md:col-span-4 rounded-3xl bg-surface-container-lowest p-8 border border-outline-variant/20 hover:bg-surface-container-high transition-all group"
            >
              <span className="material-symbols-outlined text-4xl text-secondary mb-6 group-hover:rotate-12 transition-transform">psychology</span>
              <h3 className="text-2xl font-headline font-bold mb-3">Architect AI</h3>
              <p className="text-on-surface-variant text-sm">Automated structural optimization. Let the AI build the schema while you find the insights.</p>
              <div className="mt-8 flex gap-2">
                <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
                  <div className="w-full h-full bg-white opacity-20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out delay-100"></div>
                </div>
                <div className="h-1 flex-1 bg-secondary opacity-50 rounded-full overflow-hidden">
                   <div className="w-full h-full bg-white opacity-20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out delay-200"></div>
                </div>
                <div className="h-1 flex-1 bg-secondary opacity-20 rounded-full overflow-hidden">
                   <div className="w-full h-full bg-white opacity-20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out delay-300"></div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="md:col-span-8 rounded-3xl bg-gradient-to-br from-primary-dim/40 to-surface-container-low p-10 flex flex-col md:flex-row items-center gap-10 border border-outline-variant/10 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] group-hover:bg-primary/30 transition-colors duration-1000"></div>
              <div className="flex-1 relative z-10">
                <h3 className="text-3xl font-headline font-bold mb-4 text-on-primary-container">Universal Integration</h3>
                <p className="text-on-primary-container/80 mb-6">Connect to any stack. From legacy mainframes to edge nodes, DataLens acts as the central analytics layer.</p>
                <button className="px-6 py-3 bg-on-primary-container text-primary hover:bg-white rounded-lg font-headline font-bold text-sm transition-colors">Deploy Node</button>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-4 w-full cursor-default relative z-10">
                {['database', 'cloud', 'api', 'terminal', 'security', 'hub'].map((icon, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(148, 170, 255, 0.1)' }}
                    className="aspect-square glass-panel rounded-2xl flex items-center justify-center border border-white/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-on-primary-container/70">{icon}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 bg-surface-container-lowest">
          <div className="max-w-screen-2xl mx-auto px-8">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              className="grid grid-cols-1 md:grid-cols-4 gap-12"
            >
              {[
                { value: "14.8PB", label: "Daily Throughput", color: "text-primary" },
                { value: "99.999%", label: "Architecture Uptime", color: "text-secondary" },
                { value: "<2ms", label: "Global Latency", color: "text-tertiary" },
                { value: "1.2B", label: "Signals Captured", color: "text-on-surface" }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                  }}
                  className="space-y-2"
                >
                  <div className={`text-5xl font-headline font-black ${stat.color} tracking-tighter drop-shadow-lg`}>{stat.value}</div>
                  <div className="text-xs font-label uppercase tracking-widest text-on-surface-variant">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* DataLens Explorer Section */}
        <section className="py-32 relative">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-8 flex flex-col lg:flex-row items-center gap-20">
            <motion.div 
               initial={{ opacity: 0, x: -50 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.8 }}
               className="lg:w-1/2"
            >
              <h2 className="text-4xl md:text-6xl font-headline font-extrabold mb-8 tracking-tighter">DataLens Explorer</h2>
              <div className="space-y-8">
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center border border-primary/30 group-hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-primary">search</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-headline font-bold mb-2">Multidimensional Querying</h4>
                    <p className="text-on-surface-variant text-sm leading-relaxed">Slice your data across time, space, and intent without re-indexing. Our statistical engine automatically assesses.</p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-tertiary-container/20 flex items-center justify-center border border-tertiary/30 group-hover:bg-tertiary/20 transition-colors">
                    <span className="material-symbols-outlined text-tertiary">bolt</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-headline font-bold mb-2">Instant Insight</h4>
                    <p className="text-on-surface-variant text-sm leading-relaxed">Every numeric profile in your dataset is instantly summarized with key outliers and regression metrics.</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
               initial={{ opacity: 0, x: 50 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.8 }}
               className="lg:w-1/2 relative w-full"
            >
              <div className="glass-panel border border-outline-variant/30 rounded-3xl p-4 overflow-hidden data-glow hover:shadow-[0_0_40px_rgba(148,170,255,0.2)] transition-shadow duration-500">
                <div className="flex items-center gap-2 mb-4 px-4 py-2 border-b border-outline-variant/10">
                  <div className="w-3 h-3 rounded-full bg-error"></div>
                  <div className="w-3 h-3 rounded-full bg-secondary"></div>
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <div className="ml-4 text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Query Console</div>
                </div>
                <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm space-y-3 overflow-x-auto">
                  <div className="flex gap-4 whitespace-nowrap opacity-80"><span className="text-on-surface-variant">01</span> <span className="text-secondary">SELECT</span> intelligence_stream <span className="text-secondary">FROM</span> datalens_core</div>
                  <div className="flex gap-4 whitespace-nowrap opacity-80"><span className="text-on-surface-variant">02</span> <span className="text-secondary">WHERE</span> source_type == 'EXCEL' <span className="text-secondary">AND</span> category == 'ANALYTICS'</div>
                  <div className="flex gap-4 whitespace-nowrap opacity-80"><span className="text-on-surface-variant">03</span> <span className="text-secondary">TRANSFORM</span> raw_csv <span className="text-primary">AS</span> 'galaxy_view'</div>
                  <div className="flex gap-4 whitespace-nowrap mt-2"><span className="text-on-surface-variant">04</span> <span className="text-primary-container">RUN</span> architectural_optimization_sequence()</div>
                  
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    whileInView={{ opacity: 1, height: "auto" }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="mt-6 p-4 bg-surface-container rounded-xl border border-outline-variant/10 min-w-[300px]"
                  >
                    <div className="flex items-center gap-4 text-primary mb-2">
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1.2, type: "spring" }}
                        className="material-symbols-outlined text-sm"
                      >
                        check_circle
                      </motion.span>
                      <span className="font-label tracking-widest uppercase text-xs">System Stabilized</span>
                    </div>
                    <div className="w-full bg-outline-variant/20 h-1 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: "100%" }}
                        transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                        className="h-full bg-primary"
                      ></motion.div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-4xl mx-auto px-4 md:px-8 text-center bg-gradient-to-br from-surface-container-high to-surface-container-low rounded-[2rem] md:rounded-[3rem] py-16 md:py-24 border border-outline-variant/20 relative overflow-hidden group"
          >
            <div className="absolute inset-0 z-0 opacity-40 group-hover:opacity-60 transition-opacity duration-700 mix-blend-screen">
              <img className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-1000" data-alt="technological circuit board patterns" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTTHyT1DVLcKPPVnAR-iShTvvWkJpLYFPkOKFxDIj_eJ00aam_V2R8jA-Ih02IHLcquceg_kGVFvg-2t3JeHbAHiEX7qwRQ8XkgS2pVBby5HelOAUrWQurd9KCoPxzyc5pb9o2iZYTwOXfFeSu3BXH1F5ASGipRJMOehmGyVgtHMh0ztDB32rxZDJJh56hbzOHIoc-57cSDeU2NGKXaWvv0sxsCpWpbptcAD1ivd-prECkinDLFtw5l7f_58vT1Z45ms0oGd4G0GY" alt="Circuit Background" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/10"></div>
            </div>
            <div className="relative z-10 w-full flex flex-col items-center justify-center">
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-headline font-extrabold mb-6 md:mb-8 tracking-tighter">Ready to Architect?</h2>
              <p className="text-on-surface-variant mb-10 md:mb-12 text-base md:text-lg px-4">Upload your first spreadsheet and experience the future of data intelligence.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 w-full px-6">
                <Link to="/signup" className="px-8 md:px-12 py-4 md:py-5 bg-primary text-on-primary rounded-2xl font-headline font-extrabold text-lg md:text-xl shadow-[0_10px_30px_rgba(148,170,255,0.3)] hover:scale-105 transition-all w-full sm:w-auto text-center relative overflow-hidden">
                  <span className="relative z-10">Start Free Deployment</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-[100%] hover:translate-y-0 transition-transform duration-300 rounded-2xl"></div>
                </Link>
                <button className="px-8 md:px-12 py-4 md:py-5 glass-panel border border-outline-variant rounded-2xl font-headline font-extrabold text-lg md:text-xl hover:bg-surface-container-highest transition-all w-full sm:w-auto">Talk to Sales</button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 px-8 border-t border-slate-800/30 bg-[#0e0e0e]">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-lg font-black text-slate-100 font-headline">DataLens Architect</div>
          <div className="flex flex-wrap justify-center gap-8">
            <Link className="text-slate-500 hover:text-emerald-400 transition-colors font-['Inter'] text-xs tracking-wide uppercase opacity-80 hover:opacity-100" to="#">Privacy Policy</Link>
            <Link className="text-slate-500 hover:text-emerald-400 transition-colors font-['Inter'] text-xs tracking-wide uppercase opacity-80 hover:opacity-100" to="#">Terms of Service</Link>
            <Link className="text-slate-500 hover:text-emerald-400 transition-colors font-['Inter'] text-xs tracking-wide uppercase opacity-80 hover:opacity-100" to="#">Security Architecture</Link>
            <Link className="text-slate-500 hover:text-emerald-400 transition-colors font-['Inter'] text-xs tracking-wide uppercase opacity-80 hover:opacity-100" to="#">Global Infrastructure</Link>
          </div>
          <div className="text-slate-500 font-['Inter'] text-xs tracking-wide uppercase opacity-80 text-center">
            © 2024 DataLens. All rights reserved. Precision in every pixel.
          </div>
        </div>
      </footer>
    </div>
  );
}
