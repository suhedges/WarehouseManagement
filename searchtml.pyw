import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import subprocess
import shutil
import re
from multiprocessing import Pool, cpu_count
from functools import partial
import ttkbootstrap as tb
from ttkbootstrap.constants import *
import threading
import queue
import sys
import csv
import traceback


def search_file(term, file_path, use_regex=False, search_in_filename=False):
    matches = []
    try:
        if search_in_filename:
            if use_regex:
                if re.search(term, os.path.basename(file_path), re.IGNORECASE):
                    matches.append(('Filename Match', file_path))
            else:
                if term.lower() in os.path.basename(file_path).lower():
                    matches.append(('Filename Match', file_path))
        if not search_in_filename or (search_in_filename and not matches):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    if use_regex:
                        if re.search(term, line, re.IGNORECASE):
                            matches.append(('Content Match', file_path, line_num, line.strip()))
                    else:
                        if term.lower() in line.lower():
                            matches.append(('Content Match', file_path, line_num, line.strip()))
    except Exception as e:
        return [('Error', file_path, str(e))]
    return matches

def worker(task):
    term, file_path, use_regex, search_in_filename = task
    return search_file(term, file_path, use_regex, search_in_filename)

class FileManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Advanced File Manager")
        self.root.geometry("1000x700")
        self.root.minsize(800, 600)
        
        # Initialize ttkbootstrap style
        self.style = tb.Style("flatly")  # You can choose other themes like "superhero", "cosmo", etc.
        
        # Initialize variables
        self.search_terms = tk.StringVar()
        self.use_regex = tk.BooleanVar()
        self.search_in_filename = tk.BooleanVar()
        self.exclude_patterns = tk.StringVar()
        self.max_depth = tk.IntVar(value=10)
        self.current_search_folder = ""
        
        # Queue for thread communication
        self.result_queue = queue.Queue()
        self.log_queue = queue.Queue()
        
        # Set up the GUI
        self.setup_gui()
        
    def setup_gui(self):
        notebook = ttk.Notebook(self.root)
        notebook.pack(pady=10, padx=10, expand=True, fill='both')
        
        # Search Tab
        self.search_tab = ttk.Frame(notebook)
        notebook.add(self.search_tab, text="Search Files")
        self.setup_search_tab(self.search_tab)
        
        # Intertwined Files Tab
        self.intertwined_tab = ttk.Frame(notebook)
        notebook.add(self.intertwined_tab, text="Intertwined Files")
        self.setup_intertwined_tab(self.intertwined_tab)
        
        # Log Tab
        self.log_tab = ttk.Frame(notebook)
        notebook.add(self.log_tab, text="Logs")
        self.setup_log_tab(self.log_tab)
        
    def setup_search_tab(self, tab):
        # Frame for search controls
        controls_frame = ttk.Frame(tab, padding=10)
        controls_frame.pack(fill='x', expand=True)
        
        # Configure grid columns
        controls_frame.columnconfigure(1, weight=1)  # Middle column expands
        
        # Search Term
        ttk.Label(controls_frame, text="Search Term(s):").grid(row=0, column=0, sticky='w', padx=5, pady=5)
        search_entry = ttk.Entry(controls_frame, textvariable=self.search_terms, width=50)
        search_entry.grid(row=0, column=1, padx=5, pady=5, sticky='we')
        ttk.Label(controls_frame, text="(Separate multiple terms with commas)").grid(row=0, column=2, sticky='w', padx=5, pady=5)
        
        # Use Regex
        ttk.Checkbutton(
            controls_frame, 
            text="Use Regular Expressions", 
            variable=self.use_regex
        ).grid(row=1, column=0, columnspan=3, sticky='w', padx=5, pady=5)
        
        # Search in Filename
        ttk.Checkbutton(
            controls_frame, 
            text="Search in File Names", 
            variable=self.search_in_filename
        ).grid(row=2, column=0, columnspan=3, sticky='w', padx=5, pady=5)
        
        # Exclude Patterns
        ttk.Label(controls_frame, text="Exclude Patterns:").grid(row=3, column=0, sticky='w', padx=5, pady=5)
        exclude_entry = ttk.Entry(controls_frame, textvariable=self.exclude_patterns, width=50)
        exclude_entry.grid(row=3, column=1, padx=5, pady=5, sticky='we')
        ttk.Label(controls_frame, text="(Separate patterns with commas, e.g., .git, __pycache__)").grid(row=3, column=2, sticky='w', padx=5, pady=5)
        
        # Max Depth
        ttk.Label(controls_frame, text="Max Search Depth:").grid(row=4, column=0, sticky='w', padx=5, pady=5)
        ttk.Spinbox(
            controls_frame, 
            from_=1, to=100, 
            textvariable=self.max_depth, 
            width=5
        ).grid(row=4, column=1, sticky='w', padx=5, pady=5)
        
        # Select Folder Button and Label
        ttk.Button(controls_frame, text="Select Folder", command=self.select_search_folder).grid(row=5, column=0, padx=5, pady=10, sticky='w')
        self.selected_folder_label = ttk.Label(controls_frame, text="No folder selected")
        self.selected_folder_label.grid(row=5, column=1, sticky='w', padx=5, pady=10)
        
        # Start Search Button aligned to the right
        ttk.Button(controls_frame, text="Start Search", command=self.start_search).grid(row=5, column=2, padx=5, pady=10, sticky='e')
        
        # Progress Bar
        self.progress = ttk.Progressbar(tab, mode='determinate')
        self.progress.pack(fill='x', padx=10, pady=5)
        
        # Status Label
        self.status_label = ttk.Label(tab, text="Status: Idle")
        self.status_label.pack(anchor='w', padx=10)
        
        # Results Treeview
        results_frame = ttk.Frame(tab, padding=10)
        results_frame.pack(fill='both', expand=True)
        
        columns = ("Type", "File Path", "Line Number", "Snippet")
        self.results_tree = ttk.Treeview(results_frame, columns=columns, show='headings')
        for col in columns:
            self.results_tree.heading(col, text=col)
            self.results_tree.column(col, anchor='w', width=150)
        self.results_tree.pack(side='left', fill='both', expand=True)
        
        # Scrollbar for Treeview
        scrollbar = ttk.Scrollbar(results_frame, orient="vertical", command=self.results_tree.yview)
        self.results_tree.configure(yscroll=scrollbar.set)
        scrollbar.pack(side='right', fill='y')
        
        # Bind double-click to open file
        self.results_tree.bind("<Double-1>", self.open_selected_file)
        
        # Export Button
        ttk.Button(tab, text="Export Results", command=self.export_results).pack(pady=5, anchor='e', padx=10)
        
    def setup_intertwined_tab(self, tab):
        intertwined_frame = ttk.Frame(tab, padding=20)
        intertwined_frame.pack(fill='both', expand=True)
        
        # Select Folders Button
        select_button = ttk.Button(
            intertwined_frame, 
            text="Select Folders and Find Intertwined Files", 
            command=self.select_folders_for_intertwined
        )
        select_button.pack(pady=10)
        
        # Status Label
        self.intertwined_status = ttk.Label(tab, text="Status: Idle")
        self.intertwined_status.pack(anchor='w', padx=20, pady=10)
        
    def setup_log_tab(self, tab):
        log_frame = ttk.Frame(tab, padding=10)
        log_frame.pack(fill='both', expand=True)
        
        self.log_text = tk.Text(log_frame, state='disabled', wrap='word')
        self.log_text.pack(side='left', fill='both', expand=True)
        
        scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side='right', fill='y')
        
        # Start log listener
        self.root.after(100, self.process_log_queue)
        
    def log(self, message):
        self.log_queue.put(message)
        
    def process_log_queue(self):
        try:
            while True:
                message = self.log_queue.get_nowait()
                self.log_text.configure(state='normal')
                self.log_text.insert('end', message + '\n')
                self.log_text.see('end')
                self.log_text.configure(state='disabled')
        except queue.Empty:
            pass
        self.root.after(100, self.process_log_queue)
        
    def select_search_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.current_search_folder = folder
            self.selected_folder_label.config(text=f"Selected Folder: {folder}")
            self.log(f"Selected search folder: {folder}")
        
    def start_search(self):
        if not self.current_search_folder:
            messagebox.showerror("Error", "Please select a folder to search.")
            return
        terms = self.search_terms.get().strip()
        if not terms:
            messagebox.showerror("Error", "Please enter at least one search term.")
            return
        term_list = [term.strip() for term in terms.split(",") if term.strip()]
        if not term_list:
            messagebox.showerror("Error", "Please enter valid search terms.")
            return
        exclude = [pattern.strip() for pattern in self.exclude_patterns.get().split(",") if pattern.strip()]
        max_depth = self.max_depth.get()
        use_regex = self.use_regex.get()
        search_in_filename = self.search_in_filename.get()
        
        # Clear previous results
        for item in self.results_tree.get_children():
            self.results_tree.delete(item)
        
        # Disable search button to prevent multiple searches
        self.disable_search_controls()
        
        # Start search in a separate thread
        search_thread = threading.Thread(
            target=self.perform_search, 
            args=(term_list, exclude, max_depth, use_regex, search_in_filename)
        )
        search_thread.start()
        
    def set_widget_state(self, widget, state):
        """
        Recursively set the state of widgets that support the 'state' option.
        
        Args:
            widget: The parent widget.
            state: The state to set ('disabled' or 'normal').
        """
        try:
            widget.configure(state=state)
        except tk.TclError:
            pass  # Widget does not support 'state', skip it

        for child in widget.winfo_children():
            self.set_widget_state(child, state)
        
    def disable_search_controls(self):
        self.set_widget_state(self.search_tab, 'disabled')
        self.progress.start()
        self.status_label.config(text="Status: Searching...")
        
    def enable_search_controls(self):
        self.set_widget_state(self.search_tab, 'normal')
        self.progress.stop()
        self.status_label.config(text="Status: Idle")
        
    def perform_search(self, terms, exclude, max_depth, use_regex, search_in_filename):
        try:
            all_results = []
            pool = Pool(processes=cpu_count())
            tasks = []
            total_files = 0
            allowed_extensions = {'.action', '.config', '.xml', '.scss', '.html', '.css', '.js', '.py', '.txt', '.csv', '.tsx'}  # Added .tsx

            for root, dirs, files in os.walk(self.current_search_folder):
                current_depth = root[len(self.current_search_folder):].count(os.sep)
                if current_depth >= max_depth:
                    dirs[:] = []
                    continue

                dirs[:] = [d for d in dirs if not any(re.fullmatch(p.replace('*', '.*'), d) for p in exclude)]
                filtered_files = [f for f in files if not any(re.fullmatch(p.replace('*', '.*'), f) for p in exclude)]

                for file in filtered_files:
                    if os.path.splitext(file)[1].lower() in allowed_extensions:
                        file_path = os.path.join(root, file)
                        for term in terms:
                            tasks.append((term, file_path, use_regex, search_in_filename))

                total_files += len(filtered_files) * len(terms)

            self.progress.config(maximum=total_files)
            self.log(f"Total files to search: {total_files}")

            for idx, result in enumerate(pool.imap_unordered(worker, tasks), 1):
                for match in result:
                    if match[0] == 'Error':
                        self.log(f"Error searching {match[1]}: {match[2]}")
                        continue
                    if match[0] == 'Filename Match':
                        self.results_tree.insert('', 'end', values=(match[0], match[1], '', ''))
                    elif match[0] == 'Content Match':
                        self.results_tree.insert('', 'end', values=(match[0], match[1], match[2], match[3]))
                self.progress['value'] = idx
            pool.close()
            pool.join()

            self.log("Search completed.")
            self.status_label.config(
                text=f"Status: Search completed. Found {len(self.results_tree.get_children())} result(s)."
            )
        except Exception as e:
            self.log(f"Search failed: {e}")
            messagebox.showerror("Error", f"An error occurred during search: {e}")
        finally:
            self.enable_search_controls()
        
    def open_selected_file(self, event):
        selected_item = self.results_tree.selection()
        if selected_item:
            item = self.results_tree.item(selected_item)
            file_path = item['values'][1]
            if os.path.exists(file_path):
                try:
                    if sys.platform.startswith('darwin'):
                        subprocess.call(('open', file_path))
                    elif os.name == 'nt':
                        os.startfile(file_path)
                    elif os.name == 'posix':
                        subprocess.call(('xdg-open', file_path))
                except Exception as e:
                    messagebox.showerror("Error", f"Could not open file: {e}")
            else:
                messagebox.showerror("Error", "File does not exist.")
        
    def export_results(self):
        if not self.results_tree.get_children():
            messagebox.showinfo("No Results", "There are no results to export.")
            return
        export_file = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("Text files", "*.txt")]
        )
        if export_file:
            try:
                with open(export_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    headers = ("Type", "File Path", "Line Number", "Snippet")
                    writer.writerow(headers)
                    for item in self.results_tree.get_children():
                        writer.writerow(self.results_tree.item(item)['values'])
                messagebox.showinfo("Success", f"Results exported to {export_file}")
                self.log(f"Results exported to {export_file}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export results: {e}")
        
    def select_folders_for_intertwined(self):
        # Open a new window for selecting HTML, JS, and CSS folders
        folder_window = tk.Toplevel(self.root)
        folder_window.title("Select Folders for Intertwined Files")
        folder_window.geometry("600x400")
        folder_window.resizable(False, False)
        
        # Variables to store folder paths
        html_folder = tk.StringVar()
        js_folder = tk.StringVar()
        css_folder = tk.StringVar()
        
        # Layout
        ttk.Label(folder_window, text="Select HTML Folder:").pack(pady=10)
        ttk.Entry(folder_window, textvariable=html_folder, width=60).pack(pady=5)
        ttk.Button(folder_window, text="Browse", command=lambda: self.browse_folder(html_folder)).pack(pady=5)
        
        ttk.Label(folder_window, text="Select JavaScript Folder:").pack(pady=10)
        ttk.Entry(folder_window, textvariable=js_folder, width=60).pack(pady=5)
        ttk.Button(folder_window, text="Browse", command=lambda: self.browse_folder(js_folder)).pack(pady=5)
        
        ttk.Label(folder_window, text="Select CSS Folder:").pack(pady=10)
        ttk.Entry(folder_window, textvariable=css_folder, width=60).pack(pady=5)
        ttk.Button(folder_window, text="Browse", command=lambda: self.browse_folder(css_folder)).pack(pady=5)
        
        # Find Button
        ttk.Button(
            folder_window, 
            text="Find and Copy Intertwined Files", 
            command=lambda: self.find_and_copy_intertwined(
                html_folder.get(), js_folder.get(), css_folder.get(), folder_window
            )
        ).pack(pady=20)
        
    def browse_folder(self, var):
        folder = filedialog.askdirectory()
        if folder:
            var.set(folder)
            self.log(f"Selected folder: {folder}")
        
    def find_and_copy_intertwined(self, html_folder, js_folder, css_folder, window):
        if not all([html_folder, js_folder, css_folder]):
            messagebox.showerror("Error", "Please select all three folders.")
            return
        window.destroy()
        self.intertwined_status.config(text="Status: Processing...")
        threading.Thread(target=self.process_intertwined_files, args=(html_folder, js_folder, css_folder)).start()
        
    def process_intertwined_files(self, html_folder, js_folder, css_folder):
        intertwined_files = self.find_intertwined_files(html_folder, js_folder, css_folder)
        if intertwined_files:
            script_directory = os.path.dirname(os.path.abspath(__file__))
            for primary_file, related_files in intertwined_files.items():
                primary_file_path = os.path.join(html_folder, primary_file)
                primary_folder = os.path.join(script_directory, os.path.splitext(primary_file)[0])
                try:
                    os.makedirs(primary_folder, exist_ok=True)
                except OSError as e:
                    self.log(f"Failed to create directory: {primary_folder}. Error: {e}")
                    continue
                
                if not os.path.exists(primary_file_path):
                    self.log(f"File does not exist: {primary_file_path}")
                    continue
                 
                try:
                    shutil.copy2(primary_file_path, primary_folder)
                    self.log(f"Copied {primary_file_path} to {primary_folder}")
                except Exception as e:
                    self.log(f"Failed to copy {primary_file_path}: {e}")
                    continue
                
                # Copy HTML related files
                for related_html in related_files.get("html", []):
                    related_html_path = os.path.join(html_folder, related_html)
                    if os.path.exists(related_html_path):
                        try:
                            shutil.copy2(related_html_path, primary_folder)
                            self.log(f"Copied {related_html_path} to {primary_folder}")
                        except Exception as e:
                            self.log(f"Failed to copy {related_html_path}: {e}")
                    else:
                        self.log(f"Related HTML file does not exist: {related_html_path}")
                
                # Copy JS related files
                if related_files.get("js"):
                    js_subfolder = os.path.join(primary_folder, "js")
                    try:
                        os.makedirs(js_subfolder, exist_ok=True)
                    except OSError as e:
                        self.log(f"Failed to create JS subfolder: {js_subfolder}. Error: {e}")
                        continue
                    for js_file in related_files["js"]:
                        js_file_path = os.path.join(js_folder, js_file)
                        if os.path.exists(js_file_path):
                            try:
                                shutil.copy2(js_file_path, js_subfolder)
                                self.log(f"Copied {js_file_path} to {js_subfolder}")
                            except Exception as e:
                                self.log(f"Failed to copy {js_file_path}: {e}")
                        else:
                            self.log(f"Related JS file does not exist: {js_file_path}")
                
                # Copy CSS related files
                if related_files.get("css"):
                    css_subfolder = os.path.join(primary_folder, "css")
                    try:
                        os.makedirs(css_subfolder, exist_ok=True)
                    except OSError as e:
                        self.log(f"Failed to create CSS subfolder: {css_subfolder}. Error: {e}")
                        continue
                    for css_file in related_files["css"]:
                        css_file_path = os.path.join(css_folder, css_file)
                        if os.path.exists(css_file_path):
                            try:
                                shutil.copy2(css_file_path, css_subfolder)
                                self.log(f"Copied {css_file_path} to {css_subfolder}")
                            except Exception as e:
                                self.log(f"Failed to copy {css_file_path}: {e}")
                        else:
                            self.log(f"Related CSS file does not exist: {css_file_path}")
            
            self.intertwined_status.config(text="Status: Intertwined files have been copied.")
            messagebox.showinfo("Success", "Intertwined files have been copied to respective folders.")
        else:
            self.intertwined_status.config(text="Status: No intertwined files found.")
            messagebox.showinfo("No Intertwined Files", "No intertwined files found.")
        
    def sanitize_filename(self, filename):
        """Remove trailing spaces from filenames."""
        return filename.rstrip()
    
    def rename_file_with_trailing_space(self, file_path):
        """Rename the file if it has trailing spaces."""
        directory, filename = os.path.split(file_path)
        sanitized_filename = self.sanitize_filename(filename)
        
        if sanitized_filename != filename:
            new_file_path = os.path.join(directory, sanitized_filename)
            try:
                os.rename(file_path, new_file_path)
                self.log(f"Renamed {file_path} to {new_file_path}")
                return new_file_path
            except OSError as e:
                self.log(f"Error renaming {file_path}: {e}")
        return file_path
    
    def find_intertwined_files(self, html_folder, js_folder, css_folder):
        intertwined_files = {}
        
        for root, _, files in os.walk(html_folder):
            for file in files:
                if file.lower().endswith(".html"):
                    file_path = os.path.join(root, file)
                    file_path = self.rename_file_with_trailing_space(file_path)
                    file = os.path.basename(file_path)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                    except Exception as e:
                        self.log(f"Error reading {file_path}: {e}")
                        continue
                    
                    # Find JS files referenced
                    for js_file in os.listdir(js_folder):
                        js_file_path = os.path.join(js_folder, js_file)
                        js_file_path = self.rename_file_with_trailing_space(js_file_path)
                        js_file = os.path.basename(js_file_path)
                        
                        if js_file.lower().endswith(".js") and js_file[:-3] in content:
                            intertwined_files.setdefault(file, {"js": [], "css": [], "html": []})["js"].append(js_file)
                    
                    # Find CSS files referenced
                    for css_file in os.listdir(css_folder):
                        css_file_path = os.path.join(css_folder, css_file)
                        css_file_path = self.rename_file_with_trailing_space(css_file_path)
                        css_file = os.path.basename(css_file_path)
                        
                        if css_file.lower().endswith(".css") and css_file in content:
                            intertwined_files.setdefault(file, {"js": [], "css": [], "html": []})["css"].append(css_file)
    
                    # Find other HTML files referenced
                    for other_file in files:
                        other_file_path = os.path.join(root, other_file)
                        other_file_path = self.rename_file_with_trailing_space(other_file_path)
                        other_file = os.path.basename(other_file_path)
                        
                        if other_file.lower().endswith(".html") and other_file != file and other_file in content:
                            intertwined_files.setdefault(file, {"js": [], "css": [], "html": []}).setdefault("html", []).append(other_file)
        
        return intertwined_files

def main():
    try:
        root = tb.Window()
        app = FileManagerApp(root)
        root.mainloop()
    except Exception as e:
        with open("error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        messagebox.showerror("Error", f"An unexpected error occurred:\n{e}")


if __name__ == "__main__":
    main()
